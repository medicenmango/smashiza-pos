import { cartSubtotal, cartTotal } from './nueva-orden.js';
import { state } from '../state.js';
import { toast } from '../ui/toast.js';
import { fmtMoney, peso } from '../utils/format.js';

export function wrapCanvasText(ctx, text, maxW){
  const raw=String(text||'').trim();
  if(!raw) return [];
  const words=raw.split(/\s+/);
  const lines=[];
  let cur='';
  const flushPiece=piece=>{
    const trial=cur?cur+' '+piece:piece;
    if(ctx.measureText(trial).width<=maxW){ cur=trial; return; }
    if(cur) lines.push(cur);
    if(ctx.measureText(piece).width<=maxW){ cur=piece; return; }
    let chunk='';
    for(const ch of piece){
      if(ctx.measureText(chunk+ch).width<=maxW) chunk+=ch;
      else { if(chunk) lines.push(chunk); chunk=ch; }
    }
    cur=chunk;
  };
  words.forEach(flushPiece);
  if(cur) lines.push(cur);
  return lines;
}

export function collectNewOrderTicket(){
  if(!state.cart.length) return null;
  return {
    num:(document.getElementById('orden-num-badge')?.textContent||'').replace(/^#/,''),
    cliente:document.getElementById('f-cliente')?.value.trim()||'',
    direccion:document.getElementById('f-direccion')?.value.trim()||'',
    comentarios:document.getElementById('f-comentarios')?.value.trim()||'',
    lines:state.cart.map(c=>({name:c.item.name, qty:c.qty, sub:c.item.price*c.qty})),
    subtotal:cartSubtotal(),
    ajuste:state.ajuste||0,
    total:cartTotal(),
  };
}

export function collectEditOrderTicket(){
  const modal=document.getElementById('modal-detail');
  const cart=modal?._editCart||[];
  if(!cart.length) return null;
  const ajuste=parseFloat(document.getElementById('edit-ajuste')?.value)||0;
  const sub=cart.reduce((s,c)=>s+c.price*c.qty,0);
  return {
    num:(document.getElementById('detail-num')?.textContent||'').replace(/^#/,''),
    cliente:document.getElementById('edit-cliente')?.value.trim()||'',
    direccion:document.getElementById('edit-dir')?.value.trim()||'',
    comentarios:document.getElementById('edit-comentarios')?.value.trim()||'',
    lines:cart.map(c=>({name:c.name, qty:c.qty, sub:c.price*c.qty})),
    subtotal:peso(sub),
    ajuste,
    total:peso(Math.max(0, sub+ajuste)),
  };
}

export function layoutTicket(ctx, data, W, pad){
  const inner=W-pad*2;
  const body='16px "Share Tech Mono","Courier New",monospace';
  const small='13px "Share Tech Mono","Courier New",monospace';
  const title='700 20px "Share Tech Mono","Courier New",monospace';
  const total='700 30px "Share Tech Mono","Courier New",monospace';
  const rows=[];
  const add=(kind, payload)=>rows.push({kind, ...payload});
  ctx.font=title;
  add('title', {text:'LA SMASHIZA', h:28});
  add('sub', {text:'RETRO BURGER', h:22});
  add('gap', {h:10});
  ctx.font=small;
  if(data.cliente){
    const ls=wrapCanvasText(ctx, 'Cliente: '+data.cliente, inner);
    ls.forEach(text=>add('meta', {text, h:20}));
  }
  if(data.direccion){
    const ls=wrapCanvasText(ctx, 'Dirección: '+data.direccion, inner);
    ls.forEach(text=>add('meta', {text, h:20}));
  }
  if(data.comentarios){
    const ls=wrapCanvasText(ctx, 'Notas: '+data.comentarios, inner);
    ls.forEach(text=>add('meta', {text, h:20}));
  }
  add('rule', {h:18});
  ctx.font=body;
  const priceW=90;
  data.lines.forEach(line=>{
    const left=`${line.qty}× ${line.name}`;
    const nameLines=wrapCanvasText(ctx, left, inner-priceW);
    nameLines.forEach((text,i)=>add('item', {
      text, price:i===0?fmtMoney(line.sub):'', h:24
    }));
  });
  add('rule', {h:18});
  add('sum', {label:'Subtotal', value:fmtMoney(data.subtotal), h:22});
  if(data.ajuste){
    add('sum', {
      label:data.ajuste<0?'Descuento':'Cargo extra',
      value:(data.ajuste>0?'+':'')+fmtMoney(data.ajuste),
      h:22
    });
  }
  add('total', {label:'TOTAL', value:fmtMoney(data.total), h:40});
  add('foot', {text:'Confirma tu pedido por WhatsApp', h:22});
  const height=pad + rows.reduce((s,r)=>s+r.h,0) + pad;
  return {rows, height, fonts:{body, small, title, total}, inner, priceW};
}

export function drawTicketBlob(data){
  const W=560, pad=28, scale=2;
  const probe=document.createElement('canvas').getContext('2d');
  const layout=layoutTicket(probe, data, W, pad);
  const canvas=document.createElement('canvas');
  canvas.width=W*scale; canvas.height=layout.height*scale;
  const ctx=canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle='#12082a';
  ctx.fillRect(0,0,W,layout.height);
  ctx.strokeStyle='#e63232';
  ctx.lineWidth=3;
  ctx.strokeRect(8,8,W-16,layout.height-16);
  let y=pad;
  layout.rows.forEach(r=>{
    if(r.kind==='title'){
      ctx.fillStyle='#ffd700'; ctx.font=layout.fonts.title;
      ctx.fillText(r.text, pad, y+18);
    } else if(r.kind==='sub'){
      ctx.fillStyle='#f5e6c8'; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    } else if(r.kind==='num'){
      ctx.fillStyle='#ff4444'; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    } else if(r.kind==='meta'){
      ctx.fillStyle='#d4c09a'; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    } else if(r.kind==='rule'){
      ctx.strokeStyle='#2a1a50'; ctx.lineWidth=1; ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(pad, y+8); ctx.lineTo(W-pad, y+8); ctx.stroke();
      ctx.setLineDash([]);
    } else if(r.kind==='item'){
      ctx.fillStyle='#f5e6c8'; ctx.font=layout.fonts.body;
      ctx.fillText(r.text, pad, y+16);
      if(r.price){
        ctx.fillStyle='#00e676'; ctx.textAlign='right';
        ctx.fillText(r.price, W-pad, y+16);
        ctx.textAlign='left';
      }
    } else if(r.kind==='sum'){
      ctx.fillStyle='#d4c09a'; ctx.font=layout.fonts.small;
      ctx.fillText(r.label, pad, y+14);
      ctx.textAlign='right'; ctx.fillText(r.value, W-pad, y+14); ctx.textAlign='left';
    } else if(r.kind==='total'){
      ctx.fillStyle='#ffd700'; ctx.font=layout.fonts.total;
      ctx.fillText(r.label, pad, y+26);
      ctx.textAlign='right'; ctx.fillText(r.value, W-pad, y+26); ctx.textAlign='left';
    } else if(r.kind==='foot'){
      ctx.fillStyle='#4d7fff'; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    }
    y+=r.h;
  });
  return new Promise((resolve,reject)=>{
    canvas.toBlob(b=>b?resolve(b):reject(new Error('png')), 'image/png');
  });
}

export async function writePngToClipboard(blob){
  if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined'){
    throw new Error('clipboard');
  }
  try{
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }catch(err){
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(blob) })]);
  }
}

export async function copyTicketForClient(data){
  if(!data){ toast('Agrega al menos un producto.','error'); return; }
  try{
    if(document.fonts?.ready) await document.fonts.ready;
    const blob=await drawTicketBlob(data);
    await writePngToClipboard(blob);
    toast('Ticket copiado. Pégalo en WhatsApp.','success');
  }catch(e){
    toast('No se pudo copiar la imagen. Prueba en Chrome o Edge.','error');
  }
}
