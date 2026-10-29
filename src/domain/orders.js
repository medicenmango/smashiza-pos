import { priceAt } from './catalog.js';
import { MENU } from './menu.js';
import { state } from '../state.js';
import { peso, parsePesoOptional, today } from '../utils/format.js';

export function cashBreakdown(total, recibidoOpt){
  const tot=peso(total);
  if(recibidoOpt==null) return { empty:true, short:tot>0, falta:tot, cambio:null, recibido:null };
  const rec=peso(recibidoOpt);
  if(rec<tot) return { empty:false, short:true, falta:tot-rec, cambio:0, recibido:rec };
  return { empty:false, short:false, falta:0, cambio:rec-tot, recibido:rec };
}

export function orderCashIn(o){
  if((o['Metodo_Pago']||'')!=='Efectivo') return 0;
  if(o['Estado']==='Cancelada') return 0;
  const rec=parsePesoOptional(o['Recibido']);
  const cam=parsePesoOptional(o['Cambio']);
  if(rec==null) return peso(o['Total']);
  return rec-Math.max(0, cam==null?0:cam);
}

export function todayCashInDrawer(){
  const d=today();
  return state.allOrders.filter(o=>String(o['Fecha']).startsWith(d)).reduce((s,o)=>s+orderCashIn(o),0);
}

export function orderProductSummary(o){
  const names=String(o['Productos']||'').split(' | ').filter(Boolean);
  const qtys=String(o['Cantidades']||'').split(' | ');
  if(!names.length) return 'Sin productos';
  return names.map((n,i)=>{
    const raw=String(qtys[i]||'1').replace(/x$/i,'').trim();
    const q=parseInt(raw,10);
    return `${isFinite(q)&&q>0?q:1}× ${n}`;
  }).join(' · ');
}

export function getNextOrderNum(orders){
  if(!orders.length) return 1;
  return Math.max(...orders.map(o=>parseInt(o['Num_Orden'])||0))+1;
}

export function itemsFromLegacy(order){
  const prods=String(order['Productos']||'').split(' | ').filter(Boolean);
  const qtys =String(order['Cantidades']||'').split(' | ');
  return prods.map((name,i)=>({
    Producto_Id: MENU.find(m=>m.name===name)?.id||'',
    Producto: name,
    Cantidad: parseInt(qtys[i])||1,
    Precio_Unitario: priceAt(name, order['Fecha']),
  }));
}

export function orderItems(order){
  if(!order['Items']) order['Items']=itemsFromLegacy(order);
  return order['Items'];
}

export function setOrderItems(order, items){
  order['Items']=items;
  order['Productos']=items.map(i=>i.Producto).join(' | ');
  order['Cantidades']=items.map(i=>`${i.Cantidad}x`).join(' | ');
}

export function parseOrderItems(order){
  return orderItems(order).map(i=>({ name:i.Producto, qty:i.Cantidad, price:Number(i.Precio_Unitario)||0 }));
}
