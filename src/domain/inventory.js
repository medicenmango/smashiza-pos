import { MENU } from './menu.js';
import { parseOrderItems } from './orders.js';
import { state } from '../state.js';
import { toast } from '../ui/toast.js';
import { fmtDate, fmtTime, normInvName } from '../utils/format.js';

export function snapshotOrderInv(o){
  return { Num_Orden:o['Num_Orden'], Estado:o['Estado'], Productos:o['Productos'], Cantidades:o['Cantidades'] };
}

export function findInvItem(name){
  const k=normInvName(name);
  return state.inventory.find(i=>normInvName(i['Nombre'])===k)||null;
}

export function invLevel(item){
  const stock=parseFloat(item['Stock'])||0;
  const minRaw=item['Minimo'];
  const min=parseFloat(minRaw);
  const hasMin=minRaw!=='' && minRaw!=null && !isNaN(min);
  if(stock<=0) return 'red';
  if(hasMin && stock<=min) return 'yellow';
  return 'ok';
}

export function normOrderNum(n){
  const s=String(n??'').trim();
  if(!s) return '';
  const num=parseInt(s,10);
  return Number.isFinite(num) ? String(num) : s;
}

export function movementsNetByIng(numOrden){
  const n=normOrderNum(numOrden);
  const net={};
  if(!n) return net;
  state.movements.forEach(m=>{
    if(normOrderNum(m['Num_Orden'])!==n) return;
    const t=String(m['Tipo']||'').toLowerCase();
    if(t!=='venta' && t!=='reversion') return;
    const key=normInvName(m['Ingrediente']);
    if(!key) return;
    if(!net[key]) net[key]={ name:m['Ingrediente'], qty:0, unidad:m['Unidad']||'' };
    net[key].qty += parseFloat(m['Cantidad'])||0;
  });
  return net;
}

export function recipeLinesForProduct(productName){
  const k=normInvName(productName);
  const map=new Map();
  state.recipes.forEach(r=>{
    if(normInvName(r['Producto'])!==k) return;
    const ik=normInvName(r['Ingrediente']);
    if(ik && !map.has(ik)) map.set(ik, r);
  });
  return [...map.values()];
}

export function usageFromOrder(order){
  const missing=[];
  const byIng={};
  parseOrderItems(order).forEach(line=>{
    const recs=recipeLinesForProduct(line.name);
    if(!recs.length){ missing.push(line.name); return; }
    recs.forEach(r=>{
      const key=normInvName(r['Ingrediente']);
      if(!byIng[key]) byIng[key]={ name:r['Ingrediente'], qty:0, unidad:r['Unidad']||'g' };
      byIng[key].qty += (parseFloat(r['Cantidad'])||0) * (line.qty||1);
      if(r['Unidad']) byIng[key].unidad=r['Unidad'];
    });
  });
  return { missing, lines:Object.values(byIng) };
}

export function pushMovement(tipo, ing, qty, unidad, numOrden, nota){
  const now=new Date();
  state.movements.push({
    Fecha:fmtDate(now), Hora:fmtTime(now), Tipo:tipo,
    Ingrediente:ing, Cantidad:qty, Unidad:unidad||'',
    Num_Orden:numOrden??'', Nota:nota||''
  });
}

export function applyUsageLines(lines, sign, tipo, numOrden, nota, result){
  lines.forEach(line=>{
    const item=findInvItem(line.name);
    if(!item){
      result.missingIng.push(line.name);
      return;
    }
    const before=invLevel(item);
    const next=(parseFloat(item['Stock'])||0) + sign*line.qty;
    item['Stock']=next;
    pushMovement(tipo, item['Nombre'], sign*line.qty, item['Unidad']||line.unidad, numOrden, nota);
    const after=invLevel(item);
    const rank={ok:0,yellow:1,red:2};
    if(rank[after]>rank[before]) result.crossed.push({name:item['Nombre'], from:before, to:after, stock:next, unidad:item['Unidad']});
  });
}

export function syncOrderInventory(order, opts={}){
  const result={ missing:[], missingIng:[], crossed:[], changed:false };
  if(!order) return result;
  const num=order['Num_Orden'];
  const should=!opts.deleted && String(order['Estado'])==='Entregada';
  const wanted={};
  if(should){
    const u=usageFromOrder(order);
    result.missing=u.missing;
    u.lines.forEach(l=>{
      wanted[normInvName(l.name)]={ name:l.name, qty:l.qty, unidad:l.unidad };
    });
  }
  const actual=movementsNetByIng(num);
  const keys=new Set([...Object.keys(wanted), ...Object.keys(actual)]);
  keys.forEach(k=>{
    const want=wanted[k]?.qty||0;
    const have=-(actual[k]?.qty||0);
    const delta=want-have;
    if(Math.abs(delta)<1e-9) return;
    const name=wanted[k]?.name||actual[k]?.name;
    const unidad=wanted[k]?.unidad||actual[k]?.unidad||'';
    if(delta>0){
      applyUsageLines([{ name, qty:delta, unidad }], -1, 'venta', num, 'Entrega', result);
    } else {
      applyUsageLines([{ name, qty:-delta, unidad }], +1, 'reversion', num,
        opts.deleted?'Orden eliminada':'Ajuste inventario', result);
    }
    result.changed=true;
  });
  return result;
}

export function lowInvItems(){
  return state.inventory.filter(i=>invLevel(i)!=='ok');
}

export function restockBuyItems(){
  return state.inventory.map(item=>{
    const stock=parseFloat(item['Stock'])||0;
    const ideal=parseFloat(item['Ideal']);
    if(!(ideal>0) || stock>=ideal) return null;
    return { item, stock, ideal, buy: ideal-stock };
  }).filter(Boolean).sort((a,b)=>b.buy-a.buy);
}

export function productsMissingRecipe(){
  const named=new Set(state.recipes.map(r=>normInvName(r['Producto'])));
  return MENU.filter(m=>!named.has(normInvName(m.name)));
}

export function duplicateRecipePairs(){
  const seen=new Set(), dups=new Set();
  state.recipes.forEach(r=>{
    const k=normInvName(r['Producto'])+'||'+normInvName(r['Ingrediente']);
    if(seen.has(k)) dups.add(`${r['Producto']} + ${r['Ingrediente']}`);
    else seen.add(k);
  });
  return [...dups];
}

export function writeProductRecipes(productName, lines){
  const pk=normInvName(productName);
  state.recipes=state.recipes.filter(r=>normInvName(r['Producto'])!==pk);
  lines.forEach(l=>{
    if(!l.name || !(parseFloat(l.qty)>0)) return;
    const item=findInvItem(l.name);
    state.recipes.push({
      Producto:productName,
      Ingrediente:item?item['Nombre']:l.name,
      Cantidad:parseFloat(l.qty),
      Unidad:item?item['Unidad']:(l.unidad||'g')
    });
  });
}

export function runInventorySelfTest(){
  const snap={
    inventory:state.inventory, recipes:state.recipes, movements:state.movements, allOrders:state.allOrders
  };
  const fail=[];
  const expect=(name, got, want)=>{
    const g=Number(got), w=Number(want);
    if(Math.abs(g-w)>1e-9) fail.push(`${name}: got ${g}, want ${w}`);
  };
  try{
    state.inventory=[{ Nombre:'Pan', Unidad:'pza', Stock:10, Minimo:0, Ideal:20, Proveedor:'', Nota:'' }];
    state.recipes=[{ Producto:'La Master', Ingrediente:'Pan', Cantidad:1, Unidad:'pza' }];
    state.movements=[];
    state.allOrders=[];
    const order={ Num_Orden:99, Estado:'Entregada', Productos:'La Master', Cantidades:'5x' };
    syncOrderInventory(order);
    expect('after 1st deliver', state.inventory[0].Stock, 5);
    syncOrderInventory(order);
    expect('after 2nd deliver (idempotent)', state.inventory[0].Stock, 5);
    order.Estado='Lista';
    syncOrderInventory(order);
    expect('after leave Entregada', state.inventory[0].Stock, 10);
    order.Estado='Entregada';
    syncOrderInventory(order);
    expect('after deliver again', state.inventory[0].Stock, 5);
    const leaked=10-5-2;
    state.inventory[0].Stock=3;
    state.movements=[
      { Tipo:'venta', Ingrediente:'Pan', Cantidad:-5, Num_Orden:99, Unidad:'pza' },
      { Tipo:'venta', Ingrediente:'Pan', Cantidad:-2, Num_Orden:99, Unidad:'pza' }
    ];
    order.Estado='Entregada';
    syncOrderInventory(order);
    expect('heal 10-5-2=3 back to 5', state.inventory[0].Stock, 5);
    if(leaked!==3) fail.push('fixture math');
  } finally {
    state.inventory=snap.inventory; state.recipes=snap.recipes;
    state.movements=snap.movements; state.allOrders=snap.allOrders;
  }
  const ok=!fail.length;
  console[ok?'log':'error'](ok?'[Smashiza test] inventario OK':'[Smashiza test] FAIL\n'+fail.join('\n'));
  toast(ok?'✔ Test inventario OK (datos demo, tu Excel no se tocó)':'❌ Test inventario: '+fail[0],ok?'success':'error',7000);
}
