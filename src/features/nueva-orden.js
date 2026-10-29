import { syncOrderInventory } from '../domain/inventory.js';
import { CAT_LABELS, MENU, getCatLabel } from '../domain/menu.js';
import { cashBreakdown, orderProductSummary, getNextOrderNum } from '../domain/orders.js';
import { refreshDashboard } from './dashboard.js';
import { notifyInventoryResult, renderInventory } from './inventario.js';
import { openOrderDetail, badgeClass } from './ordenes.js';
import { state } from '../state.js';
import { persistWorkbook } from '../storage/excel.js';
import { relTime } from '../ui/clock.js';
import { toast } from '../ui/toast.js';
import { fmtDate, fmtTime, fmtMoney, peso, parsePesoOptional, today, escHtml, foldTxt } from '../utils/format.js';

export function stampNewOrderWhen(){
  const now=new Date();
  const f=document.getElementById('f-fecha');
  if(f) f.value=fmtDate(now);
}

export function initLiveOrderWhen(){
  const refresh=()=>{ if(!document.hidden) stampNewOrderWhen(); };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
}

export function renderLiveQueue(){
  const el=document.getElementById('live-orders');
  if(!el) return;
  const todayStr=today();
  const active=new Set(['Pendiente','Preparando','Lista']);
  const rows=state.allOrders
    .filter(o=>String(o['Fecha']).startsWith(todayStr) && active.has(o['Estado']))
    .sort((a,b)=>(parseInt(b['Num_Orden'])||0)-(parseInt(a['Num_Orden'])||0))
    .slice(0,5);
  if(!rows.length){ el.innerHTML='<div class="empty-list">Sin órdenes activas hoy</div>'; return; }
  el.innerHTML=rows.map(o=>{
    const rt=relTime(o['Fecha'],o['Hora']);
    return `<div class="live-row" data-orden="${o['Num_Orden']}">
      <span class="rel-time ${rt.cls}" data-fecha="${o['Fecha']}" data-hora="${o['Hora']}">${rt.label}</span>
      <span class="live-client">${escHtml(o['Cliente']||'Sin nombre')}</span>
      <span class="${badgeClass(o['Estado'])}">${escHtml(o['Estado']||'')}</span>
      <span class="live-products">${escHtml(orderProductSummary(o))}</span>
      <span class="live-total">${fmtMoney(o['Total']||0)}</span>
    </div>`;
  }).join('');
  el.querySelectorAll('.live-row').forEach(row=>row.addEventListener('click',()=>openOrderDetail(row.dataset.orden)));
}

export function getKnownClients(){
  const seen=new Map();
  for(let i=state.allOrders.length-1;i>=0;i--){
    const o=state.allOrders[i];
    const cliente=(o['Cliente']||'').trim();
    if(!cliente||cliente.toLowerCase()==='sin nombre') continue;
    const direccion=(o['Direccion']||'').trim();
    const key=foldTxt(cliente)+'\n'+foldTxt(direccion);
    if(!seen.has(key)) seen.set(key,{cliente,direccion});
  }
  return [...seen.values()];
}

export function renderClienteSuggestions(){
  const inp=document.getElementById('f-cliente');
  const dir=document.getElementById('f-direccion');
  const list=document.getElementById('cliente-suggestions');
  if(!inp||!list) return;
  const q=foldTxt(inp.value.trim());
  if(!q){
    list.classList.add('hidden');
    list.innerHTML='';
    inp.setAttribute('aria-expanded','false');
    return;
  }
  const matches=getKnownClients().filter(c=>foldTxt(c.cliente).includes(q)).slice(0,20);
  if(!matches.length){
    list.classList.add('hidden');
    list.innerHTML='';
    inp.setAttribute('aria-expanded','false');
    return;
  }
  list.innerHTML=matches.map(c=>`
    <div class="suggestion-item" data-cliente="${escHtml(c.cliente)}" data-dir="${escHtml(c.direccion)}">
      <span class="sug-name">${escHtml(c.cliente)}</span>
      ${c.direccion?`<span class="sug-dir">${escHtml(c.direccion)}</span>`:''}
    </div>`).join('');
  list.classList.remove('hidden');
  inp.setAttribute('aria-expanded','true');
  list.querySelectorAll('.suggestion-item').forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      inp.value=el.dataset.cliente||'';
      if(dir) dir.value=el.dataset.dir||'';
      list.classList.add('hidden');
      list.innerHTML='';
      inp.setAttribute('aria-expanded','false');
    });
  });
}

export function initClienteAutocomplete(){
  const inp=document.getElementById('f-cliente');
  const list=document.getElementById('cliente-suggestions');
  if(!inp||!list) return;
  inp.addEventListener('input',renderClienteSuggestions);
  inp.addEventListener('focus',renderClienteSuggestions);
  document.addEventListener('pointerdown',e=>{
    if(!inp.contains(e.target)&&!list.contains(e.target)){
      list.classList.add('hidden');
      inp.setAttribute('aria-expanded','false');
    }
  });
}

export function menuItemMatches(item, q){
  if(!q) return true;
  return item.name.toLowerCase().includes(q)
    || item.cat.toLowerCase().includes(q)
    || getCatLabel(item.cat).toLowerCase().includes(q);
}

export function otherCatSearchHits(q, excludeCat){
  if(!q || excludeCat==='all') return [];
  const counts={};
  MENU.forEach(i=>{
    if(i.cat===excludeCat) return;
    if(!menuItemMatches(i, q)) return;
    counts[i.cat]=(counts[i.cat]||0)+1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

export function searchElseHtml(q){
  const hits=otherCatSearchHits(q, state.activeCat);
  if(!hits.length) return '';
  return `<div class="search-else">En otras: ${hits.map(([cat,n])=>
    `<button type="button" class="search-else-btn" data-cat="${escHtml(cat)}">${escHtml(getCatLabel(cat))} ${n}</button>`
  ).join('')}</div>`;
}

export function bindSearchElse(root){
  root.querySelectorAll('.search-else-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      state.activeCat=btn.dataset.cat;
      renderCategoryBtns();
      renderMenuGrid();
    });
  });
}

export function getFilteredMenuItems(){
  let items = state.activeCat==='all' ? MENU : MENU.filter(i=>i.cat===state.activeCat);
  const q = state.menuSearch.trim().toLowerCase();
  if(q) items=items.filter(i=>menuItemMatches(i, q));
  // Apply custom sort order per category
  return items.sort((a,b)=>{
    const orderA=state.menuOrder[a.cat]||[];
    const orderB=state.menuOrder[b.cat]||[];
    const ia=orderA.indexOf(a.id), ib=orderB.indexOf(b.id);
    if(ia===-1&&ib===-1) return 0;
    if(ia===-1) return 1;
    if(ib===-1) return -1;
    return ia-ib;
  });
}

export function renderMenuGrid(){
  const grid=document.getElementById('menu-grid');
  const items=getFilteredMenuItems();
  const q=state.menuSearch.trim().toLowerCase();
  const elseHtml=searchElseHtml(q);
  if(!items.length){
    const here=state.activeCat==='all'?'':' en '+getCatLabel(state.activeCat);
    grid.innerHTML=`<div class="empty-list">${q?`Sin resultados${here}`:'Sin resultados'}</div>${elseHtml}`;
    bindSearchElse(grid);
    return;
  }
  grid.innerHTML=items.map(item=>`
    <button class="menu-item-btn ${state.cart.find(c=>c.item.id===item.id)?'active-item':''}" data-id="${item.id}">
      <span class="menu-item-emoji">${item.emoji}</span>
      <span class="menu-item-name">${escHtml(item.name)}</span>
      <span class="menu-item-price">${fmtMoney(item.price)}</span>
    </button>`).join('')+elseHtml;
  grid.querySelectorAll('.menu-item-btn').forEach(btn=>btn.addEventListener('click',()=>addToCart(btn.dataset.id)));
  bindSearchElse(grid);
}

export function initMenuSearch(){
  const inp=document.getElementById('menu-search');
  if(!inp) return;
  inp.addEventListener('input',()=>{ state.menuSearch=inp.value; renderMenuGrid(); });
}

export function renderCategoryBtns(){
  const wrap=document.getElementById('menu-cat-btns');
  if(!wrap) return;
  const catsFromLabels=Object.keys(CAT_LABELS);
  const catsFromMenu=[...new Set(MENU.map(i=>i.cat))];
  const cats=[...new Set([...catsFromLabels,...catsFromMenu])];
  wrap.innerHTML=
    `<button class="cat-btn ${state.activeCat==='all'?'active':''}" data-cat="all">TODO</button>`+
    cats.map(c=>`<button class="cat-btn ${state.activeCat===c?'active':''}" data-cat="${c}">${getCatLabel(c)}</button>`).join('');
  wrap.querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ state.activeCat=btn.dataset.cat; renderCategoryBtns(); renderMenuGrid(); });
  });
}

export function initCategoryBtns(){ renderCategoryBtns(); }

export function addToCart(itemId){
  const item=MENU.find(i=>i.id===itemId); if(!item) return;
  const existing=state.cart.find(c=>c.item.id===itemId);
  if(existing) existing.qty++; else state.cart.push({item,qty:1});
  renderCart(); renderMenuGrid();
}

export function removeFromCart(itemId){
  state.cart=state.cart.filter(c=>c.item.id!==itemId);
  renderCart(); renderMenuGrid();
}

export function changeQty(itemId,delta){
  const e=state.cart.find(c=>c.item.id===itemId); if(!e) return;
  e.qty+=delta;
  if(e.qty<=0) removeFromCart(itemId); else { renderCart(); renderMenuGrid(); }
}

export function cartSubtotal(){ return state.cart.reduce((s,c)=>s+c.item.price*c.qty,0); }

export function cartTotal()   { return peso(Math.max(0,cartSubtotal()+state.ajuste)); }

export function renderCashResult(el, total, recibidoOpt){
  if(!el) return;
  const b=cashBreakdown(total, recibidoOpt);
  if(b.empty){
    el.className='cash-result cash-warn';
    el.textContent=total>0?'Escribe con cuánto paga (se puede guardar igual).':'';
    return;
  }
  if(b.short){
    el.className='cash-result cash-short';
    el.textContent=`Falta ${fmtMoney(b.falta)}`;
    return;
  }
  el.className='cash-result cash-ok';
  el.textContent=b.cambio===0?'Cambio: $0':'Cambio: '+fmtMoney(b.cambio);
}

export function updateCashUI(){
  const wrap=document.getElementById('cash-wrap');
  if(!wrap) return;
  const isCash=state.payMethod==='Efectivo';
  wrap.classList.toggle('hidden', !isCash);
  if(!isCash) return;
  renderCashResult(document.getElementById('cash-result'), cartTotal(), parsePesoOptional(document.getElementById('f-recibido')?.value));
}

export function applyCashQuick(inputId, amount){
  const inp=document.getElementById(inputId); if(!inp) return;
  if(amount==='exact'){
    const total=inputId==='f-recibido'?cartTotal():(()=>{
      const modal=document.getElementById('modal-detail');
      const cart=modal?._editCart||[];
      const ajuste=parseFloat(document.getElementById('edit-ajuste')?.value)||0;
      return peso(Math.max(0, cart.reduce((s,c)=>s+c.price*c.qty,0)+ajuste));
    })();
    inp.value=String(total);
  } else inp.value=String(amount);
  inp.dispatchEvent(new Event('input'));
}

export function renderCart(){
  const el=document.getElementById('ticket-items');
  const subEl=document.getElementById('ticket-subtotal');
  const ajEl=document.getElementById('ticket-ajuste-display');
  const totEl=document.getElementById('ticket-total');
  if(!state.cart.length){
    if(state.ajuste){
      state.ajuste=0;
      const ajInp=document.getElementById('f-ajuste');
      if(ajInp) ajInp.value='';
    }
    if(ajEl){ ajEl.textContent=''; ajEl.className='ticket-ajuste-display'; }
    el.innerHTML='<div class="empty-ticket">Sin productos</div>';
    subEl&&(subEl.textContent='$0'); totEl.textContent='$0';
    updateCashUI();
    return;
  }
  el.innerHTML=state.cart.map(c=>`
    <div class="ticket-row">
      <span class="ticket-item-name">${c.item.emoji} ${escHtml(c.item.name)}</span>
      <div class="ticket-qty-ctrl">
        <button class="qty-btn" data-id="${c.item.id}" data-delta="-1">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="qty-btn" data-id="${c.item.id}" data-delta="1">+</button>
      </div>
      <span class="ticket-item-subtotal">${fmtMoney(c.item.price*c.qty)}</span>
      <button class="btn-del-item" data-id="${c.item.id}">✕</button>
    </div>`).join('');
  const sub=cartSubtotal();
  if(subEl) subEl.textContent=fmtMoney(sub);
  const aj=state.ajuste;
  if(ajEl){
    if(aj===0){ ajEl.textContent=''; ajEl.className='ticket-ajuste-display'; }
    else if(aj<0){ ajEl.textContent=`Descuento: ${fmtMoney(aj)}`; ajEl.className='ticket-ajuste-display ajuste-neg'; }
    else { ajEl.textContent=`Cargo extra: +${fmtMoney(aj)}`; ajEl.className='ticket-ajuste-display ajuste-pos'; }
  }
  totEl.textContent=fmtMoney(cartTotal());
  el.querySelectorAll('.qty-btn').forEach(btn=>btn.addEventListener('click',()=>changeQty(btn.dataset.id,parseInt(btn.dataset.delta))));
  el.querySelectorAll('.btn-del-item').forEach(btn=>btn.addEventListener('click',()=>removeFromCart(btn.dataset.id)));
  updateCashUI();
}

export function initAjuste(){
  const inp=document.getElementById('f-ajuste'); if(!inp) return;
  inp.addEventListener('input',()=>{ state.ajuste=parseFloat(inp.value)||0; renderCart(); });
}

export function initPayToggle(){
  document.querySelectorAll('.pay-opt').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.pay-opt').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.payMethod=btn.dataset.pay;
      updateCashUI();
    });
  });
  const rec=document.getElementById('f-recibido');
  if(rec) rec.addEventListener('input',updateCashUI);
  document.querySelectorAll('.cash-quick-btn').forEach(btn=>{
    btn.addEventListener('click',()=>applyCashQuick('f-recibido', btn.dataset.cash));
  });
  updateCashUI();
}

export function updateOrderNumBadge(){
  document.getElementById('orden-num-badge').textContent=`#${String(getNextOrderNum(state.allOrders)).padStart(4,'0')}`;
}

export async function saveOrder(){
  if(!state.workbook){ toast('⚠️ No hay Excel cargado.','error'); return; }
  if(!state.cart.length){ toast('⚠️ Agrega al menos un producto.','error'); return; }
  if(state.payMethod==='Efectivo' && parsePesoOptional(document.getElementById('f-recibido')?.value)==null){
    toast('En efectivo pon con cuánto pagan ($200, $500 o EXACTO)','error');
    document.getElementById('f-recibido')?.focus();
    return;
  }
  const now=new Date();
  const numOrden=getNextOrderNum(state.allOrders);
  const newRow={
    Num_Orden:numOrden,
    Fecha:fmtDate(now),
    Hora:fmtTime(now),
    Cliente:document.getElementById('f-cliente').value.trim()||'Sin nombre',
    Direccion:document.getElementById('f-direccion').value.trim(),
    Productos:state.cart.map(c=>c.item.name).join(' | '),
    Cantidades:state.cart.map(c=>`${c.qty}x`).join(' | '),
    Comentarios:document.getElementById('f-comentarios').value.trim(),
    Metodo_Pago:state.payMethod, Ajuste:state.ajuste||0, Total:cartTotal(),
    Recibido:'', Cambio:'',
    Estado:document.getElementById('f-estado').value,
  };
  if(state.payMethod==='Efectivo'){
    const cash=cashBreakdown(newRow.Total, parsePesoOptional(document.getElementById('f-recibido')?.value));
    newRow.Recibido=cash.recibido; newRow.Cambio=cash.cambio;
  }
  state.allOrders.push(newRow);
  const invRes=syncOrderInventory(newRow);
  try{
    await persistWorkbook();
    toast(`✔ Orden #${String(numOrden).padStart(4,'0')} guardada`,'success');
    notifyInventoryResult(invRes);
    clearForm(); updateOrderNumBadge(); refreshDashboard(); renderInventory();
  }catch(e){ toast('Error al guardar: '+e.message,'error',5000); }
}

export function clearForm(){
  document.getElementById('f-cliente').value='';
  document.getElementById('f-direccion').value='';
  document.getElementById('f-comentarios').value='';
  document.getElementById('f-estado').value='Pendiente';
  const aj=document.getElementById('f-ajuste'); if(aj) aj.value='';
  const recInp=document.getElementById('f-recibido'); if(recInp) recInp.value='';
  stampNewOrderWhen();
  state.cart=[]; state.ajuste=0; state.payMethod='Efectivo';
  document.querySelectorAll('.pay-opt').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderCart(); renderMenuGrid();
  updateCashUI();
}
