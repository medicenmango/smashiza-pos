import { peso, toYmd, toHms } from '../utils/format.js';

/** Timestamp local de una orden (Fecha + Hora). */
export function orderLocalDate(o){
  const f=toYmd(o['Fecha']);
  if(!f) return null;
  const h=(toHms(o['Hora'])||'00:00:00').slice(0,8);
  const d=new Date(`${f}T${h}`);
  return Number.isNaN(d.getTime())?null:d;
}

/**
 * Ventas del turno: no canceladas, en [from, to).
 * Efectivo/Transferencia/Tarjeta = suma de Total.
 */
export function shiftSalesTotals(orders, fromDate, toDate){
  const from=fromDate instanceof Date?fromDate:new Date(fromDate);
  const to=toDate? (toDate instanceof Date?toDate:new Date(toDate)) : new Date();
  const out={
    salesEfectivo:0,
    salesTransferencia:0,
    salesTarjeta:0,
    orderCount:0,
    other:0,
  };
  (orders||[]).forEach(o=>{
    if(o._deleted || o['Estado']==='Cancelada') return;
    const when=orderLocalDate(o);
    if(!when) return;
    if(when < from || when >= to) return;
    const total=peso(o['Total']);
    const method=String(o['Metodo_Pago']||'');
    out.orderCount+=1;
    if(method==='Efectivo') out.salesEfectivo+=total;
    else if(method==='Transferencia') out.salesTransferencia+=total;
    else if(method==='Tarjeta') out.salesTarjeta+=total;
    else out.other+=total;
  });
  return out;
}

export function expectedCash(openingCash, salesEfectivo){
  return peso(openingCash)+peso(salesEfectivo);
}

export function shiftDifference(countedCash, expected){
  return peso(countedCash)-peso(expected);
}
