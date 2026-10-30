import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';
import { normOrderNum } from '../domain/inventory.js';
import { orderItems, setOrderItems } from '../domain/orders.js';
import { state } from '../state.js';
import { emitDataLoaded } from './events.js';
import { menuCatalogRows, applyMenuFromRows, applyCatalogFromRows } from './rows.js';
import { toast } from '../ui/toast.js';
import { toYmd, toHms, fmtDate, fmtTime } from '../utils/format.js';

let client=null;
let loaded=false;

function db(){
  if(!client){
    if(typeof supabase==='undefined') throw new Error('No se pudo cargar Supabase. Revisa tu conexión a internet.');
    client=supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return client;
}

function check({ data, error }){
  if(error) throw new Error(error.message);
  return data;
}

const str=v=>String(v??'').trim();
const num=v=>{ const n=parseFloat(v); return isFinite(n)?n:0; };
const numOrNull=v=>{ if(v===''||v==null) return null; const n=parseFloat(v); return isFinite(n)?n:null; };

// ── Auth ──────────────────────────────────────────────────────
export async function currentUser(){
  const { data }=await db().auth.getSession();
  return data.session?.user||null;
}

export async function signIn(email, password){
  check(await db().auth.signInWithPassword({ email, password }));
}

export async function signOut(){
  loaded=false;
  await db().auth.signOut();
}

// ── Row mapping (state shape ↔ DB) ────────────────────────────
function orderToDb(o){
  return {
    num:parseInt(o['Num_Orden'],10),
    fecha:toYmd(o['Fecha']),
    hora:toHms(o['Hora'])||'00:00:00',
    cliente:str(o['Cliente']),
    direccion:str(o['Direccion']||o['Telefono']),
    comentarios:str(o['Comentarios']),
    metodo_pago:str(o['Metodo_Pago'])||'Efectivo',
    ajuste:num(o['Ajuste']),
    total:num(o['Total']),
    recibido:numOrNull(o['Recibido']),
    cambio:numOrNull(o['Cambio']),
    estado:str(o['Estado'])||'Pendiente',
  };
}

function itemsToDb(o){
  return orderItems(o)
    .filter(i=>str(i.Producto) && (parseInt(i.Cantidad)||0)>0)
    .map((i,idx)=>({
      line:idx+1,
      product_id:str(i.Producto_Id),
      product:str(i.Producto),
      qty:parseInt(i.Cantidad),
      unit_price:Math.max(0, num(i.Precio_Unitario)),
    }));
}

function orderFromDb(r, items){
  const o={
    Num_Orden:r.num, Fecha:r.fecha, Hora:r.hora,
    Cliente:r.cliente, Direccion:r.direccion, Comentarios:r.comentarios,
    Metodo_Pago:r.metodo_pago, Ajuste:Number(r.ajuste)||0, Total:Number(r.total)||0,
    Recibido:r.recibido??'', Cambio:r.cambio??'', Estado:r.estado,
  };
  setOrderItems(o, items.map(i=>({
    Producto_Id:i.product_id, Producto:i.product, Cantidad:i.qty, Precio_Unitario:Number(i.unit_price)||0,
  })));
  return o;
}

function movementToDb(m){
  const n=parseInt(m['Num_Orden'],10);
  return {
    fecha:toYmd(m['Fecha'])||fmtDate(),
    hora:toHms(m['Hora'])||fmtTime(),
    tipo:str(m['Tipo']),
    ingredient:str(m['Ingrediente']),
    qty:num(m['Cantidad']),
    unit:str(m['Unidad']),
    order_num:Number.isFinite(n)?n:null,
    nota:str(m['Nota']),
  };
}

// ── Tables synced by diff against the last saved snapshot ─────
const SYNC={
  categories:{
    pk:['id'],
    rows:()=>menuCatalogRows().catRows.map((r,i)=>({ id:str(r.Id), label:str(r.Etiqueta), sort:i })),
  },
  menu_items:{
    pk:['id'],
    rows:()=>menuCatalogRows().menuRows.map(r=>({
      id:str(r.Id), category:str(r.Categoria), emoji:str(r.Emoji), name:str(r.Nombre),
      price:Math.max(0, num(r.Precio)), sort:parseInt(r.Orden)||0,
    })),
  },
  catalog:{
    pk:['name'],
    rows:()=>menuCatalogRows().catalogRows.map(r=>({
      name:str(r.Producto), emoji:str(r.Emoji), category:str(r.Categoria), on_menu:r.EnMenu==='si',
    })),
  },
  product_costs:{
    pk:['name'],
    rows:()=>menuCatalogRows().costRows.map(r=>({ name:str(r.Producto), cost:Math.max(0, num(r.Costo)) })),
  },
  price_history:{
    pk:['name','since'],
    rows:()=>menuCatalogRows().priceRows.map(r=>({
      name:str(r.Producto), since:toYmd(r.Desde)||'2000-01-01', price:Math.max(0, num(r.Precio)),
    })),
  },
  inventory:{
    pk:['name'],
    rows:()=>state.inventory.map(i=>({
      name:str(i['Nombre']), unit:str(i['Unidad']), stock:num(i['Stock']),
      minimo:num(i['Minimo']), ideal:num(i['Ideal']), proveedor:str(i['Proveedor']), nota:str(i['Nota']),
    })),
  },
  recipes:{
    pk:['product','ingredient'],
    rows:()=>state.recipes.map(r=>({
      product:str(r['Producto']), ingredient:str(r['Ingrediente']), qty:num(r['Cantidad']), unit:str(r['Unidad']),
    })).filter(r=>r.qty>0),
  },
};
const MENU_TABLES=['categories','menu_items','catalog','product_costs','price_history'];
const INV_TABLES=['inventory','recipes'];

const saved={};
const keyOf=(t,r)=>SYNC[t].pk.map(c=>r[c]).join('\u0000');

function currentRows(t){
  const byKey=new Map();
  SYNC[t].rows().forEach(r=>{
    const k=keyOf(t,r);
    // Keep the first duplicate: that's the one recipes/inventory lookups use.
    if(SYNC[t].pk.every(c=>r[c]!=='') && !byKey.has(k)) byKey.set(k, r);
  });
  return byKey;
}

function remember(t){
  saved[t]=new Map([...currentRows(t)].map(([k,r])=>[k, JSON.stringify(r)]));
}

async function syncTable(t){
  const prev=saved[t]||new Map();
  const rows=currentRows(t);
  const next=new Map();
  const changed=[];
  rows.forEach((r,k)=>{
    const j=JSON.stringify(r);
    next.set(k,j);
    if(prev.get(k)!==j) changed.push(r);
  });
  for(const [k,j] of prev){
    if(next.has(k)) continue;
    const r=JSON.parse(j);
    let q=db().from(t).delete();
    SYNC[t].pk.forEach(c=>{ q=q.eq(c, r[c]); });
    check(await q);
  }
  if(changed.length) check(await db().from(t).upsert(changed, { onConflict:SYNC[t].pk.join(',') }));
  saved[t]=next;
}

async function pushMovements(){
  const fresh=state.movements.filter(m=>!m._id);
  if(!fresh.length) return;
  const ids=check(await db().from('inventory_movements').insert(fresh.map(movementToDb)).select('id'));
  fresh.forEach((m,i)=>{ m._id=ids[i]?.id; });
}

async function syncInventory(){
  await pushMovements();
  for(const t of INV_TABLES) await syncTable(t);
}

async function syncMenuCatalog(){
  for(const t of MENU_TABLES) await syncTable(t);
}

// ── Load ──────────────────────────────────────────────────────
async function fetchAll(table, orderBy, filter){
  const out=[];
  const size=1000;
  for(let from=0;;from+=size){
    let q=db().from(table).select('*');
    if(filter) q=filter(q);
    orderBy.forEach(c=>{ q=q.order(c); });
    const rows=check(await q.range(from, from+size-1));
    out.push(...rows);
    if(rows.length<size) return out;
  }
}

export async function countRows(table){
  const { count, error }=await db().from(table).select('*', { count:'exact', head:true });
  if(error) throw new Error(error.message);
  return count||0;
}

export async function loadFromSupabase(){
  const [orders, items, inv, recipes, movements, cats, menu, catalog, costs, prices]=await Promise.all([
    fetchAll('orders', ['num'], q=>q.is('deleted_at', null)),
    fetchAll('order_items', ['order_num','line']),
    fetchAll('inventory', ['name']),
    fetchAll('recipes', ['product','ingredient']),
    fetchAll('inventory_movements', ['id']),
    fetchAll('categories', ['sort','id']),
    fetchAll('menu_items', ['category','sort']),
    fetchAll('catalog', ['name']),
    fetchAll('product_costs', ['name']),
    fetchAll('price_history', ['name','since']),
  ]);
  const user=await currentUser();

  state.workbook=null;
  state.fileHandle=null;
  state.demoMode=false;
  state.fileName=user?.email||'Supabase';

  const byOrder=new Map();
  items.forEach(i=>{
    if(!byOrder.has(i.order_num)) byOrder.set(i.order_num, []);
    byOrder.get(i.order_num).push(i);
  });
  state.allOrders=orders.map(r=>orderFromDb(r, byOrder.get(r.num)||[]));
  state.inventory=inv.map(r=>({
    Nombre:r.name, Unidad:r.unit, Stock:Number(r.stock)||0, Minimo:Number(r.minimo)||0,
    Ideal:Number(r.ideal)||0, Proveedor:r.proveedor, Nota:r.nota,
  }));
  state.recipes=recipes.map(r=>({ Producto:r.product, Ingrediente:r.ingredient, Cantidad:Number(r.qty)||0, Unidad:r.unit }));
  state.movements=movements.map(r=>({
    Fecha:r.fecha, Hora:r.hora, Tipo:r.tipo, Ingrediente:r.ingredient, Cantidad:Number(r.qty)||0,
    Unidad:r.unit, Num_Orden:r.order_num??'', Nota:r.nota, _id:r.id,
  }));

  state._hydrating=true;
  if(menu.length){
    applyMenuFromRows(
      menu.map(r=>({ Id:r.id, Categoria:r.category, Emoji:r.emoji, Nombre:r.name, Precio:Number(r.price)||0, Orden:r.sort })),
      cats.map(r=>({ Id:r.id, Etiqueta:r.label })),
    );
  }
  if(catalog.length||costs.length||prices.length){
    applyCatalogFromRows(
      costs.map(r=>({ Producto:r.name, Costo:Number(r.cost)||0 })),
      catalog.map(r=>({ Producto:r.name, Emoji:r.emoji, Categoria:r.category, EnMenu:r.on_menu?'si':'no' })),
      prices.map(r=>({ Producto:r.name, Desde:r.since, Precio:Number(r.price)||0 })),
    );
  }
  state._hydrating=false;

  // A table that came back empty is "unsaved", so the next save uploads what the app has.
  const fetched={ categories:cats, menu_items:menu, catalog, product_costs:costs, price_history:prices, inventory:inv, recipes };
  Object.keys(SYNC).forEach(t=>{ if(fetched[t].length) remember(t); else saved[t]=new Map(); });

  loaded=true;
  emitDataLoaded();
}

// ── Orders ────────────────────────────────────────────────────
async function rpcSaveOrder(o, isNew){
  const finalNum=check(await db().rpc('save_order', {
    p_order:orderToDb(o), p_items:itemsToDb(o), p_is_new:isNew,
  }));
  if(isNew && String(finalNum)!==normOrderNum(o['Num_Orden'])){
    const old=normOrderNum(o['Num_Orden']);
    state.movements.forEach(m=>{ if(!m._id && normOrderNum(m['Num_Orden'])===old) m['Num_Orden']=finalNum; });
    o['Num_Orden']=finalNum;
    toast(`Otro dispositivo usó el #${old}: esta orden quedó como #${finalNum}`,'info',7000);
  }
}

// Orders whose save failed (e.g. no internet) are retried on the next save. In memory only.
const pendingOrders=new Map();

async function saveOrderAndInventory(o, isNew){
  pendingOrders.set(o, isNew || !!pendingOrders.get(o));
  for(const [p, pIsNew] of [...pendingOrders]){
    if(state.allOrders.includes(p)) await rpcSaveOrder(p, pIsNew);
    pendingOrders.delete(p);
  }
  await syncInventory();
}

// ── Import from Excel (state already loaded from a workbook) ──
async function insertChunks(table, rows){
  for(let i=0;i<rows.length;i+=500){
    check(await db().from(table).insert(rows.slice(i, i+500)));
  }
}

export async function importStateToSupabase(){
  if(await countRows('orders')>0) throw new Error('La base ya tiene órdenes; no importo para no duplicar.');
  const skipped=[];
  const seen=new Set();
  const orderRows=[], itemRows=[];
  state.allOrders.forEach(o=>{
    const r=orderToDb(o);
    if(!(r.num>0) || !r.fecha || seen.has(r.num)){ skipped.push(o['Num_Orden']); return; }
    seen.add(r.num);
    orderRows.push(r);
    itemsToDb(o).forEach(i=>itemRows.push({ order_num:r.num, ...i }));
  });
  Object.keys(SYNC).forEach(t=>{ saved[t]=new Map(); });
  await syncMenuCatalog();
  await insertChunks('orders', orderRows);
  await insertChunks('order_items', itemRows);
  for(const t of INV_TABLES) await syncTable(t);
  await insertChunks('inventory_movements', state.movements.map(movementToDb));
  return { orders:orderRows.length, items:itemRows.length, movements:state.movements.length, skipped };
}

export async function uploadMenuCatalog(){
  await syncMenuCatalog();
}

export const supabaseBackend={
  isReady:()=>loaded,
  canReload:()=>loaded,
  reload:()=>loadFromSupabase(),
  saveNewOrder:o=>saveOrderAndInventory(o, true),
  saveOrder:o=>saveOrderAndInventory(o, false),
  deleteOrder:async numOrden=>{
    check(await db().from('orders').update({ deleted_at:new Date().toISOString() }).eq('num', parseInt(numOrden,10)));
    await syncInventory();
  },
  saveInventory:()=>syncInventory(),
  saveMenuCatalog:()=>syncMenuCatalog(),
};
