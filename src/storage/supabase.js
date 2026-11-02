import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';
import { BUSINESS_STORAGE_KEY, SMASHIZA_BUSINESS_ID } from '../constants.js';
import { normOrderNum } from '../domain/inventory.js';
import { orderItems, setOrderItems } from '../domain/orders.js';
import { state } from '../state.js';
import { emitDataLoaded, emitSyncChange } from './events.js';
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

export function isNetworkError(e){
  return /fetch|network|load failed|timeout|offline|conexión/i.test(String(e?.message||e));
}

const str=v=>String(v??'').trim();
const num=v=>{ const n=parseFloat(v); return isFinite(n)?n:0; };
const numOrNull=v=>{ if(v===''||v==null) return null; const n=parseFloat(v); return isFinite(n)?n:null; };

function requireBusinessId(){
  if(!state.businessId) throw new Error('No hay negocio activo. Cierra sesión y vuelve a entrar.');
  return state.businessId;
}

function withBiz(row){
  return { ...row, business_id:requireBusinessId() };
}

function scopeBiz(q){
  return q.eq('business_id', requireBusinessId());
}

// ── Auth + negocio activo ─────────────────────────────────────
export async function currentUser(){
  const { data }=await db().auth.getSession();
  return data.session?.user||null;
}

export async function signIn(email, password){
  check(await db().auth.signInWithPassword({ email, password }));
}

export async function signOut(){
  loaded=false;
  outbox=[]; persistOutbox();
  clearBusinessState();
  await clearCache();
  await db().auth.signOut();
}

function readStoredBusinessId(){
  try{ return localStorage.getItem(BUSINESS_STORAGE_KEY)||''; }catch(_){ return ''; }
}

function storeBusinessId(id){
  try{
    if(id) localStorage.setItem(BUSINESS_STORAGE_KEY, id);
    else localStorage.removeItem(BUSINESS_STORAGE_KEY);
  }catch(_){}
}

function mapBusinessRow(r){
  return {
    id:r.id,
    name:r.name,
    slug:r.slug,
    role:r.role,
    ticketName:r.ticket_name||r.name||'',
    ticketTagline:r.ticket_tagline||'',
    phone:r.phone||'',
    ticketFooter:r.ticket_footer||'',
    logoPath:r.logo_path||'',
    colorPrimary:r.color_primary||'#e63232',
    colorSecondary:r.color_secondary||'#1a3bcc',
    colorBg:r.color_bg||'#0d0820',
  };
}

function applyBusiness(b){
  state.businessId=b.id;
  state.businessName=b.name||'';
  state.businessRole=b.role||'';
  state.ticketName=b.ticketName||b.name||'';
  state.ticketTagline=b.ticketTagline||'';
  state.phone=b.phone||'';
  state.ticketFooter=b.ticketFooter||'';
  state.logoPath=b.logoPath||'';
  state.colorPrimary=b.colorPrimary||'#e63232';
  state.colorSecondary=b.colorSecondary||'#1a3bcc';
  state.colorBg=b.colorBg||'#0d0820';
  storeBusinessId(b.id);
}

function clearBusinessState(){
  state.businessId=null;
  state.businessName='';
  state.businessRole='';
  state.businesses=[];
  state.ticketName='';
  state.ticketTagline='';
  state.phone='';
  state.ticketFooter='';
  state.logoPath='';
  state.colorPrimary='';
  state.colorSecondary='';
  state.colorBg='';
  storeBusinessId('');
}

/** Carga membresías y elige negocio. Sin membresías → null (UI de crear negocio). */
export async function resolveActiveBusiness(){
  const list=check(await db().rpc('list_my_businesses'))||[];
  state.businesses=list.map(mapBusinessRow);
  if(!state.businesses.length){
    clearBusinessState();
    return null;
  }
  const preferred=readStoredBusinessId();
  const pick=
    state.businesses.find(b=>b.id===preferred)
    || state.businesses.find(b=>b.id===SMASHIZA_BUSINESS_ID)
    || state.businesses[0];
  applyBusiness(pick);
  return pick;
}

export function getActiveBusiness(){
  return state.businessId
    ? {
      id:state.businessId, name:state.businessName, role:state.businessRole,
      ticketName:state.ticketName, ticketTagline:state.ticketTagline,
      phone:state.phone, ticketFooter:state.ticketFooter, logoPath:state.logoPath,
      colorPrimary:state.colorPrimary, colorSecondary:state.colorSecondary, colorBg:state.colorBg,
    }
    : null;
}

/** Cambia el negocio activo (localStorage + state) y recarga para traer sus datos. */
export function switchActiveBusiness(businessId){
  const id=String(businessId||'');
  const row=state.businesses.find(b=>b.id===id);
  if(!row) throw new Error('Ese negocio no está en tu lista.');
  if(row.id===state.businessId) return false;
  applyBusiness(row);
  return true;
}

export async function signUp(email, password){
  const { data, error }=await db().auth.signUp({ email, password });
  if(error) throw new Error(error.message);
  if(!data.session){
    throw new Error('Cuenta creada. Revisa tu correo para confirmar antes de entrar.');
  }
  return data.user;
}

export async function createMyBusiness({ name, ticketName, ticketTagline, phone, ticketFooter }={}){
  const id=check(await db().rpc('create_my_business', {
    p_name:name,
    p_ticket_name:ticketName||null,
    p_ticket_tagline:ticketTagline||null,
    p_phone:phone||null,
    p_ticket_footer:ticketFooter||null,
  }));
  const biz=await resolveActiveBusiness();
  if(biz?.id!==id){
    const row=state.businesses.find(b=>b.id===id);
    if(row) applyBusiness(row);
  }
  return id;
}

export async function updateMyBusinessBranding({
  ticketName, ticketTagline, phone, ticketFooter, logoPath,
}={}){
  const bid=requireBusinessId();
  const args={
    p_business_id:bid,
    p_ticket_name:ticketName,
    p_ticket_tagline:ticketTagline??'',
    p_phone:phone??'',
    p_ticket_footer:ticketFooter??'',
  };
  if(logoPath!==undefined) args.p_logo_path=logoPath;
  check(await db().rpc('update_my_business_branding', args));
  state.ticketName=ticketName||'';
  state.ticketTagline=ticketTagline||'';
  state.phone=phone||'';
  state.ticketFooter=ticketFooter||'';
  if(logoPath!==undefined) state.logoPath=logoPath||'';
  state.businessName=state.ticketName||state.businessName;
  const i=state.businesses.findIndex(b=>b.id===bid);
  if(i>=0){
    state.businesses[i]={
      ...state.businesses[i],
      name:state.businessName,
      ticketName:state.ticketName,
      ticketTagline:state.ticketTagline,
      phone:state.phone,
      ticketFooter:state.ticketFooter,
      logoPath:state.logoPath,
    };
  }
}

export async function updateMyBusinessTheme({ colorPrimary, colorSecondary, colorBg }={}){
  const bid=requireBusinessId();
  check(await db().rpc('update_my_business_theme', {
    p_business_id:bid,
    p_color_primary:colorPrimary,
    p_color_secondary:colorSecondary,
    p_color_bg:colorBg,
  }));
  state.colorPrimary=colorPrimary;
  state.colorSecondary=colorSecondary;
  state.colorBg=colorBg;
  const i=state.businesses.findIndex(b=>b.id===bid);
  if(i>=0){
    state.businesses[i]={
      ...state.businesses[i],
      colorPrimary, colorSecondary, colorBg,
    };
  }
}

export async function uploadBusinessLogo(file){
  const bid=requireBusinessId();
  if(!file) throw new Error('Elige una imagen de logo.');
  if(!/^image\//.test(file.type||'')) throw new Error('El logo debe ser una imagen (PNG, JPG o WebP).');
  if(file.size>2*1024*1024) throw new Error('El logo debe pesar menos de 2 MB.');
  const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png';
  const path=`${bid}/logo.${ext==='jpeg'?'jpg':ext}`;
  const { error }=await db().storage.from('business-logos').upload(path, file, {
    upsert:true,
    contentType:file.type||'image/png',
    cacheControl:'3600',
  });
  if(error) throw new Error(error.message);
  await updateMyBusinessBranding({
    ticketName:state.ticketName||state.businessName,
    ticketTagline:state.ticketTagline,
    phone:state.phone,
    ticketFooter:state.ticketFooter,
    logoPath:path,
  });
  return path;
}

export async function clearBusinessLogo(){
  await updateMyBusinessBranding({
    ticketName:state.ticketName||state.businessName,
    ticketTagline:state.ticketTagline,
    phone:state.phone,
    ticketFooter:state.ticketFooter,
    logoPath:'',
  });
}

// ── Row mapping (state shape ↔ DB) ────────────────────────────
function orderToDb(o){
  return withBiz({
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
    client_id:o._cid||null,
  });
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
  if(r.client_id) o._cid=r.client_id;
  setOrderItems(o, items.map(i=>({
    Producto_Id:i.product_id, Producto:i.product, Cantidad:i.qty, Precio_Unitario:Number(i.unit_price)||0,
  })));
  return o;
}

function movementToDb(m){
  const n=parseInt(m['Num_Orden'],10);
  return withBiz({
    fecha:toYmd(m['Fecha'])||fmtDate(),
    hora:toHms(m['Hora'])||fmtTime(),
    tipo:str(m['Tipo']),
    ingredient:str(m['Ingrediente']),
    qty:num(m['Cantidad']),
    unit:str(m['Unidad']),
    order_num:Number.isFinite(n)?n:null,
    nota:str(m['Nota']),
  });
}

// ── Tables synced by diff against the last saved snapshot ─────
// serverOwned: columns the database maintains (stock moves only through movements).
// pk siempre incluye business_id (composite PK multi-tenant).
const SYNC={
  categories:{
    pk:['business_id','id'],
    rows:()=>menuCatalogRows().catRows.map((r,i)=>withBiz({ id:str(r.Id), label:str(r.Etiqueta), sort:i })),
  },
  menu_items:{
    pk:['business_id','id'],
    rows:()=>menuCatalogRows().menuRows.map(r=>withBiz({
      id:str(r.Id), category:str(r.Categoria), emoji:str(r.Emoji), name:str(r.Nombre),
      price:Math.max(0, num(r.Precio)), sort:parseInt(r.Orden)||0,
    })),
  },
  catalog:{
    pk:['business_id','name'],
    rows:()=>menuCatalogRows().catalogRows.map(r=>withBiz({
      name:str(r.Producto), emoji:str(r.Emoji), category:str(r.Categoria), on_menu:r.EnMenu==='si',
    })),
  },
  product_costs:{
    pk:['business_id','name'],
    rows:()=>menuCatalogRows().costRows.map(r=>withBiz({ name:str(r.Producto), cost:Math.max(0, num(r.Costo)) })),
  },
  price_history:{
    pk:['business_id','name','since'],
    rows:()=>menuCatalogRows().priceRows.map(r=>withBiz({
      name:str(r.Producto), since:toYmd(r.Desde)||'2000-01-01', price:Math.max(0, num(r.Precio)),
    })),
  },
  inventory:{
    pk:['business_id','name'],
    serverOwned:['stock'],
    rows:()=>state.inventory.map(i=>withBiz({
      name:str(i['Nombre']), unit:str(i['Unidad']), stock:num(i['Stock']),
      minimo:num(i['Minimo']), ideal:num(i['Ideal']), proveedor:str(i['Proveedor']), nota:str(i['Nota']),
    })),
  },
  recipes:{
    pk:['business_id','product','ingredient'],
    rows:()=>state.recipes.map(r=>withBiz({
      product:str(r['Producto']), ingredient:str(r['Ingrediente']), qty:num(r['Cantidad']), unit:str(r['Unidad']),
    })).filter(r=>r.qty>0),
  },
};
const MENU_TABLES=['categories','menu_items','catalog','product_costs','price_history'];
const INV_TABLES=['inventory','recipes'];

let saved={};
const keyOf=(t,r)=>SYNC[t].pk.map(c=>r[c]).join('\u0000');

function withoutServerOwned(t, r){
  const owned=SYNC[t].serverOwned;
  if(!owned) return r;
  const copy={ ...r };
  owned.forEach(c=>delete copy[c]);
  return copy;
}

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
  saved[t]=new Map([...currentRows(t)].map(([k,r])=>[k, JSON.stringify(withoutServerOwned(t,r))]));
}

// Queues the rows that changed since the last save. New rows go complete; existing rows
// skip server-owned columns so a stale local stock never overwrites the database.
function queueTableDiff(t){
  const prev=saved[t]||new Map();
  const next=new Map();
  const added=[], changed=[];
  currentRows(t).forEach((r,k)=>{
    const slim=withoutServerOwned(t,r);
    const j=JSON.stringify(slim);
    next.set(k,j);
    if(!prev.has(k)) added.push(r);
    else if(prev.get(k)!==j) changed.push(slim);
  });
  for(const [k,j] of prev){
    if(next.has(k)) continue;
    const r=JSON.parse(j);
    enqueue({ k:'rm', t, pk:Object.fromEntries(SYNC[t].pk.map(c=>[c, r[c]])) });
  }
  if(added.length) enqueue({ k:'up', t, rows:added });
  if(changed.length) enqueue({ k:'up', t, rows:changed });
  saved[t]=next;
}

function queueNewMovements(){
  const fresh=state.movements.filter(m=>!m._cid);
  if(!fresh.length) return;
  fresh.forEach(m=>{ m._cid=crypto.randomUUID(); });
  enqueue({ k:'mov', rows:fresh.map(m=>({ ...movementToDb(m), client_id:m._cid })) });
}

function queueInventory(){
  // Movements first: for a brand-new item the movement finds no row yet, then the
  // insert carries the full stock; for existing items the trigger applies the delta.
  queueNewMovements();
  INV_TABLES.forEach(queueTableDiff);
}

// ── Outbox: every change is stored on the device, then uploaded in order ──
const OUTBOX_KEY='smashiza_outbox_v1';
let outbox=(()=>{ try{ return JSON.parse(localStorage.getItem(OUTBOX_KEY)||'[]'); }catch(_){ return []; } })();
let offline=false;
let flushing=null;
let offlineNoticeShown=false;

function persistOutbox(){
  try{ localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); }
  catch(e){ console.error('[Smashiza] no se pudo guardar la cola local', e); }
  emitSyncChange();
}

export function syncStatus(){ return { pending:outbox.length, offline }; }

function enqueue(op){
  if(op.k==='order'){
    const same=p=>p.k==='order' && (op.order.client_id
      ? p.order.client_id===op.order.client_id
      : p.order.num===op.order.num);
    const prev=outbox.find(same);
    if(prev){
      op.isNew=op.isNew||prev.isNew;
      outbox=outbox.filter(p=>p!==prev);
    }
  }
  outbox.push(op);
}

function renumber(oldNum, newNum, cid){
  const o=state.allOrders.find(x=>cid ? x._cid===cid : normOrderNum(x['Num_Orden'])===String(oldNum));
  if(o) o['Num_Orden']=newNum;
  state.movements.forEach(m=>{ if(!m._db && normOrderNum(m['Num_Orden'])===String(oldNum)) m['Num_Orden']=newNum; });
  outbox.forEach(p=>{
    if(p.k==='order' && p.order.num===oldNum) p.order.num=newNum;
    if(p.k==='del' && p.num===oldNum) p.num=newNum;
    if(p.k==='mov') p.rows.forEach(r=>{ if(r.order_num===oldNum) r.order_num=newNum; });
  });
  toast(`Otro dispositivo usó el #${oldNum}: esta orden quedó como #${newNum}`,'info',7000);
  emitDataLoaded();
}

async function runOp(op){
  switch(op.k){
    case 'order': {
      if(!op.order.business_id) op.order.business_id=requireBusinessId();
      const finalNum=check(await db().rpc('save_order', { p_order:op.order, p_items:op.items, p_is_new:op.isNew }));
      if(finalNum!==op.order.num) renumber(op.order.num, finalNum, op.order.client_id);
      return;
    }
    case 'del':
      check(await scopeBiz(db().from('orders').update({ deleted_at:op.at }).eq('num', op.num)));
      return;
    case 'mov': {
      const rows=(op.rows||[]).map(r=>r.business_id?r:withBiz(r));
      check(await db().from('inventory_movements').upsert(rows, {
        onConflict:'business_id,client_id', ignoreDuplicates:true,
      }));
      return;
    }
    case 'up': {
      const rows=(op.rows||[]).map(r=>r.business_id?r:withBiz(r));
      check(await db().from(op.t).upsert(rows, { onConflict:SYNC[op.t].pk.join(',') }));
      return;
    }
    case 'rm': {
      const pk=op.pk.business_id?op.pk:{ ...op.pk, business_id:requireBusinessId() };
      let q=db().from(op.t).delete();
      Object.entries(pk).forEach(([c,v])=>{ q=q.eq(c, v); });
      check(await q);
      return;
    }
  }
}

function describeOp(op){
  if(op.k==='order') return `orden #${op.order.num}`;
  if(op.k==='del') return `borrar orden #${op.num}`;
  if(op.k==='mov') return 'movimientos de inventario';
  return op.t;
}

async function doFlush(){
  while(outbox.length){
    const op=outbox[0];
    try{ await runOp(op); }
    catch(e){
      if(isNetworkError(e)){ offline=true; emitSyncChange(); throw e; }
      // The database rejected it: retrying won't help, so set it aside instead of blocking the queue.
      outbox.shift();
      persistOutbox();
      keepFailed(op, e.message);
      throw new Error(`No se pudo guardar (${describeOp(op)}): ${e.message}`);
    }
    outbox.shift();
    persistOutbox();
  }
  offline=false;
  offlineNoticeShown=false;
  emitSyncChange();
}

export function flush(){
  if(!flushing) flushing=doFlush().finally(()=>{ flushing=null; });
  return flushing;
}

function keepFailed(op, message){
  try{
    const failed=JSON.parse(localStorage.getItem('smashiza_outbox_failed')||'[]');
    failed.push({ at:new Date().toISOString(), message, op });
    localStorage.setItem('smashiza_outbox_failed', JSON.stringify(failed.slice(-50)));
  }catch(_){}
  console.error('[Smashiza] cambio rechazado por la base', message, op);
}

// Saves locally right away; uploading can wait for the connection.
async function commit(){
  persistOutbox();
  await cacheState();
  try{
    await flush();
    await cacheState();
  }catch(e){
    if(!isNetworkError(e)) throw e;
    if(!offlineNoticeShown){
      toast('📴 Sin conexión: se guardó en este dispositivo y se sube solo al volver internet.','info',7000);
      offlineNoticeShown=true;
    }
  }
}

export function startAutoSync(){
  const retry=()=>{
    if(!outbox.length) return;
    flush().then(()=>cacheState()).catch(e=>{ if(!isNetworkError(e)) toast(e.message,'error',8000); });
  };
  window.addEventListener('online', retry);
  setInterval(retry, 30000);
}

// ── Device cache (IndexedDB) so the app opens without internet ──
function idb(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('smashiza-cache', 1);
    r.onupgradeneeded=()=>r.result.createObjectStore('kv');
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}

async function idbTx(mode, fn){
  const d=await idb();
  return new Promise((res,rej)=>{
    const tx=d.transaction('kv', mode);
    const req=fn(tx.objectStore('kv'));
    tx.oncomplete=()=>res(req?.result);
    tx.onerror=()=>rej(tx.error);
  });
}

async function cacheState(){
  try{
    await idbTx('readwrite', s=>s.put({
      allOrders:state.allOrders, inventory:state.inventory, recipes:state.recipes, movements:state.movements,
      saved:Object.fromEntries(Object.entries(saved).map(([t,m])=>[t,[...m]])),
      fileName:state.fileName, at:Date.now(),
      businessId:state.businessId, businessName:state.businessName, businessRole:state.businessRole,
      ticketName:state.ticketName, ticketTagline:state.ticketTagline, phone:state.phone,
      ticketFooter:state.ticketFooter, logoPath:state.logoPath,
      colorPrimary:state.colorPrimary, colorSecondary:state.colorSecondary, colorBg:state.colorBg,
    }, 'state'));
  }catch(e){ console.warn('[Smashiza] no se pudo guardar la copia local', e); }
}

async function clearCache(){
  try{ await idbTx('readwrite', s=>s.delete('state')); }catch(_){}
}

export async function hasCache(){
  try{ return !!(await idbTx('readonly', s=>s.get('state'))); }catch(_){ return false; }
}

export async function loadFromCache(){
  const c=await idbTx('readonly', s=>s.get('state'));
  if(!c) throw new Error('Sin conexión y este dispositivo no tiene datos guardados todavía.');
  state.workbook=null;
  state.fileHandle=null;
  state.demoMode=false;
  state.fileName=c.fileName;
  state.allOrders=c.allOrders;
  state.inventory=c.inventory;
  state.recipes=c.recipes;
  state.movements=c.movements;
  if(c.businessId){
    state.businessId=c.businessId;
    state.businessName=c.businessName||'';
    state.businessRole=c.businessRole||'';
    state.ticketName=c.ticketName||c.businessName||'';
    state.ticketTagline=c.ticketTagline||'';
    state.phone=c.phone||'';
    state.ticketFooter=c.ticketFooter||'';
    state.logoPath=c.logoPath||'';
    state.colorPrimary=c.colorPrimary||'#e63232';
    state.colorSecondary=c.colorSecondary||'#1a3bcc';
    state.colorBg=c.colorBg||'#0d0820';
  }
  saved=Object.fromEntries(Object.entries(c.saved||{}).map(([t,entries])=>[t,new Map(entries)]));
  offline=true;
  loaded=true;
  emitDataLoaded();
  emitSyncChange();
}

// ── Load ──────────────────────────────────────────────────────
async function fetchAll(table, orderBy, filter){
  const out=[];
  const size=1000;
  for(let from=0;;from+=size){
    let q=scopeBiz(db().from(table).select('*'));
    if(filter) q=filter(q);
    orderBy.forEach(c=>{ q=q.order(c); });
    const rows=check(await q.range(from, from+size-1));
    out.push(...rows);
    if(rows.length<size) return out;
  }
}

/** Cuenta filas del negocio activo (o de toda la tabla si aún no hay negocio). */
export async function countRows(table){
  let q=db().from(table).select('*', { count:'exact', head:true });
  if(state.businessId) q=q.eq('business_id', state.businessId);
  const { count, error }=await q;
  if(error) throw new Error(error.message);
  return count||0;
}

export async function loadFromSupabase(){
  if(!state.businessId) await resolveActiveBusiness();
  // Upload pending changes first so the fresh data already includes them.
  await flush();
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
  const bizLabel=state.businessName?` · ${state.businessName}`:'';
  state.fileName=(user?.email||'Supabase')+bizLabel;

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
  // _cid marks a movement as already uploaded; imported ones have no client_id, so use the db id.
  state.movements=movements.map(r=>({
    Fecha:r.fecha, Hora:r.hora, Tipo:r.tipo, Ingrediente:r.ingredient, Cantidad:Number(r.qty)||0,
    Unidad:r.unit, Num_Orden:r.order_num??'', Nota:r.nota, _db:true, _cid:r.client_id||`db-${r.id}`,
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
  saved={};
  Object.keys(SYNC).forEach(t=>{ if(fetched[t].length) remember(t); else saved[t]=new Map(); });

  offline=false;
  loaded=true;
  await cacheState();
  emitDataLoaded();
  emitSyncChange();
}

// ── Import from Excel (state already loaded from a workbook). Needs internet. ──
async function insertChunks(table, rows){
  for(let i=0;i<rows.length;i+=500){
    check(await db().from(table).insert(rows.slice(i, i+500)));
  }
}

export async function importStateToSupabase(){
  if(!state.businessId) await resolveActiveBusiness();
  if(await countRows('orders')>0) throw new Error('Este negocio ya tiene órdenes; no importo para no duplicar.');
  const bid=requireBusinessId();
  const skipped=[];
  const seen=new Set();
  const orderRows=[], itemRows=[];
  state.allOrders.forEach(o=>{
    const r=orderToDb(o);
    if(!(r.num>0) || !r.fecha || seen.has(r.num)){ skipped.push(o['Num_Orden']); return; }
    seen.add(r.num);
    orderRows.push(r);
    itemsToDb(o).forEach(i=>itemRows.push({ business_id:bid, order_num:r.num, ...i }));
  });
  saved={};
  Object.keys(SYNC).forEach(t=>{ saved[t]=new Map(); });
  MENU_TABLES.forEach(queueTableDiff);
  await flush();
  await insertChunks('orders', orderRows);
  await insertChunks('order_items', itemRows);
  // History goes in before the inventory rows exist, so the stock trigger doesn't count it twice.
  await insertChunks('inventory_movements', state.movements.map(movementToDb));
  INV_TABLES.forEach(queueTableDiff);
  await flush();
  return { orders:orderRows.length, items:itemRows.length, movements:state.movements.length, skipped };
}

export async function uploadMenuCatalog(){
  MENU_TABLES.forEach(queueTableDiff);
  await commit();
}

function queueOrder(o, isNew){
  if(isNew && !o._cid) o._cid=crypto.randomUUID();
  enqueue({ k:'order', isNew, order:orderToDb(o), items:itemsToDb(o) });
}

export const supabaseBackend={
  isReady:()=>loaded,
  canReload:()=>loaded,
  reload:()=>loadFromSupabase(),
  saveNewOrder:async o=>{ queueOrder(o, true); queueInventory(); await commit(); },
  saveOrder:async o=>{ queueOrder(o, false); queueInventory(); await commit(); },
  deleteOrder:async numOrden=>{
    enqueue({ k:'del', num:parseInt(numOrden,10), at:new Date().toISOString() });
    queueInventory();
    await commit();
  },
  saveInventory:async()=>{ queueInventory(); await commit(); },
  saveMenuCatalog:async()=>{ MENU_TABLES.forEach(queueTableDiff); await commit(); },
};
