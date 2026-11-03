import { activeBranding } from '../domain/branding.js';
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

function loadLogoImage(url){
  if(!url) return Promise.resolve(null);
  return new Promise(resolve=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=url;
  });
}

export function layoutTicket(ctx, data, W, pad, brand, logoImg){
  const inner=W-pad*2;
  const body='16px "Share Tech Mono","Courier New",monospace';
  const small='13px "Share Tech Mono","Courier New",monospace';
  const title='700 20px "Share Tech Mono","Courier New",monospace';
  const total='700 30px "Share Tech Mono","Courier New",monospace';
  const rows=[];
  const add=(kind, payload)=>rows.push({kind, ...payload});
  if(logoImg){
    const maxH=72, maxW=inner;
    const scale=Math.min(maxW/logoImg.width, maxH/logoImg.height, 1);
    add('logo', {img:logoImg, w:logoImg.width*scale, h:logoImg.height*scale+10});
  }
  // Nombre comercial del tenant (Smashiza u otro); nunca hardcodear otra marca.
  const displayName=(brand.name||'MI NEGOCIO').trim()||'MI NEGOCIO';
  ctx.font=title;
  const nameLines=wrapCanvasText(ctx, displayName.toUpperCase(), inner);
  nameLines.forEach((text,i)=>add(i===0?'title':'sub', {text, h:i===0?28:22}));
  if(brand.tagline){
    ctx.font=small;
    wrapCanvasText(ctx, brand.tagline.toUpperCase(), inner).forEach(text=>add('sub', {text, h:20}));
  }
  if(brand.phone){
    ctx.font=small;
    add('meta', {text:'Tel: '+brand.phone, h:20});
  }
  const num=String(data.num||'').replace(/^#/,'').trim();
  if(num){
    ctx.font=small;
    add('num', {text:'Orden #'+String(num).padStart(4,'0'), h:22});
  }
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
    const nameItemLines=wrapCanvasText(ctx, left, inner-priceW);
    nameItemLines.forEach((text,i)=>add('item', {
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
  if(brand.footer){
    ctx.font=small;
    wrapCanvasText(ctx, brand.footer, inner).forEach(text=>add('foot', {text, h:20}));
  }
  add('powered', {text:brand.poweredBy||'powered by Smashiza', h:22});
  const height=pad + rows.reduce((s,r)=>s+r.h,0) + pad;
  return {rows, height, fonts:{body, small, title, total}, inner, priceW};
}

export async function drawTicketBlob(data){
  const brand=activeBranding();
  const logoImg=await loadLogoImage(brand.logoUrl);
  const W=560, pad=28, scale=2;
  const probe=document.createElement('canvas').getContext('2d');
  const layout=layoutTicket(probe, data, W, pad, brand, logoImg);
  const canvas=document.createElement('canvas');
  canvas.width=W*scale; canvas.height=layout.height*scale;
  const ctx=canvas.getContext('2d');
  ctx.scale(scale, scale);
  // Colores del tenant (tema); Smashiza sigue en su paleta por defecto.
  const bg=brand.bg||'#12082a';
  const accent=brand.primary||'#e63232';
  const beige=brand.beige||'#f5e6c8';
  const blue=brand.secondary||'#1a3bcc';
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,W,layout.height);
  ctx.strokeStyle=accent;
  ctx.lineWidth=3;
  ctx.strokeRect(8,8,W-16,layout.height-16);
  let y=pad;
  layout.rows.forEach(r=>{
    if(r.kind==='logo'){
      const x=pad+(layout.inner-r.w)/2;
      ctx.drawImage(r.img, x, y, r.w, r.h-10);
    } else if(r.kind==='title'){
      ctx.fillStyle='#ffd700'; ctx.font=layout.fonts.title;
      ctx.fillText(r.text, pad, y+18);
    } else if(r.kind==='sub'){
      ctx.fillStyle=beige; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    } else if(r.kind==='num'){
      ctx.fillStyle=accent; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    } else if(r.kind==='meta'){
      ctx.fillStyle=beige; ctx.globalAlpha=0.85;
      ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
      ctx.globalAlpha=1;
    } else if(r.kind==='rule'){
      ctx.strokeStyle=accent; ctx.globalAlpha=0.35; ctx.lineWidth=1; ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(pad, y+8); ctx.lineTo(W-pad, y+8); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
    } else if(r.kind==='item'){
      ctx.fillStyle=beige; ctx.font=layout.fonts.body;
      ctx.fillText(r.text, pad, y+16);
      if(r.price){
        ctx.fillStyle='#00e676'; ctx.textAlign='right';
        ctx.fillText(r.price, W-pad, y+16);
        ctx.textAlign='left';
      }
    } else if(r.kind==='sum'){
      ctx.fillStyle=beige; ctx.globalAlpha=0.85; ctx.font=layout.fonts.small;
      ctx.fillText(r.label, pad, y+14);
      ctx.textAlign='right'; ctx.fillText(r.value, W-pad, y+14); ctx.textAlign='left';
      ctx.globalAlpha=1;
    } else if(r.kind==='total'){
      ctx.fillStyle='#ffd700'; ctx.font=layout.fonts.total;
      ctx.fillText(r.label, pad, y+26);
      ctx.textAlign='right'; ctx.fillText(r.value, W-pad, y+26); ctx.textAlign='left';
    } else if(r.kind==='foot'){
      ctx.fillStyle=blue; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
    } else if(r.kind==='powered'){
      ctx.fillStyle=beige; ctx.globalAlpha=0.55; ctx.font=layout.fonts.small;
      ctx.fillText(r.text, pad, y+14);
      ctx.globalAlpha=1;
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
    const brand=activeBranding();
    const blob=await drawTicketBlob(data);
    await writePngToClipboard(blob);
    const who=brand.name||'tu negocio';
    toast(`Ticket de ${who} copiado. Pégalo en WhatsApp.`,'success');
  }catch(e){
    toast('No se pudo copiar la imagen. Prueba en Chrome o Edge.','error');
  }
}
