import { ESTADOS } from '../constants.js';
import { snapshotOrderInv, syncOrderInventory } from '../domain/inventory.js';
import { MENU } from '../domain/menu.js';
import { cashBreakdown, todayCashInDrawer, orderItems, setOrderItems } from '../domain/orders.js';
import { refreshDashboard } from './dashboard.js';
import { notifyInventoryResult, renderInventory } from './inventario.js';
import { renderCashResult, applyCashQuick } from './nueva-orden.js';
import { collectEditOrderTicket, copyTicketForClient } from './ticket.js';
import { state } from '../state.js';
import { canReload, reload, saveOrder, deleteOrder } from '../storage/index.js';
import { relTime } from '../ui/clock.js';
import { toast } from '../ui/toast.js';
import { toYmd, toHms, fmtMoney, peso, parsePesoOptional, today, escHtml } from '../utils/format.js';

export function updateEditCashUI(){
  const wrap=document.getElementById('edit-cash-wrap');
  const pago=document.getElementById('edit-pago');
  if(!wrap||!pago) return;
  const isCash=pago.value==='Efectivo';
  wrap.classList.toggle('hidden', !isCash);
  if(!isCash) return;
  const modal=document.getElementById('modal-detail');
  const cart=modal?._editCart||[];
  const ajuste=parseFloat(document.getElementById('edit-ajuste')?.value)||0;
  const total=peso(Math.max(0, cart.reduce((s,c)=>s+c.price*c.qty,0)+ajuste));
  renderCashResult(document.getElementById('edit-cash-result'), total, parsePesoOptional(document.getElementById('edit-recibido')?.value));
}

export async function reloadData(){
  if(!canReload()){ toast('No hay datos cargados.','error'); return; }
  try{ await reload(); toast('✔ Datos recargados','success'); refreshDashboard(); renderOrdersTable(); renderInventory(); }
  catch(e){ toast('Error: '+e.message,'error'); }
}

export async function updateOrderStatus(numOrden,newEstado){
  const o=state.allOrders.find(o=>String(o['Num_Orden'])===String(numOrden));
  if(!o) return;
  const prev=snapshotOrderInv(o);
  o['Estado']=newEstado;
  const invRes=syncOrderInventory(o,{prev});
  try{ await saveOrder(o); toast(`✔ #${String(numOrden).padStart(4,'0')} → ${newEstado}`,'success');
    notifyInventoryResult(invRes);
    refreshDashboard(); renderOrdersTable(); renderInventory();
  }catch(e){ toast('Error: '+e.message,'error'); }
}

export function buildEditCartHtml(editCart){
  if(!editCart.length) return '<div class="empty-ticket" style="padding:.5rem">Sin productos</div>';
  return editCart.map((c,idx)=>`
    <div class="ticket-row edit-cart-row" data-idx="${idx}">
      <span class="ticket-item-name">${c.emoji} ${escHtml(c.name)}</span>
      <div class="ticket-qty-ctrl">
        <button class="edit-qty-btn" data-idx="${idx}" data-delta="-1">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="edit-qty-btn" data-idx="${idx}" data-delta="1">+</button>
      </div>
      <span class="ticket-item-subtotal">${fmtMoney(c.price*c.qty)}</span>
      <button class="btn-del-item edit-del-btn" data-idx="${idx}">✕</button>
    </div>`).join('');
}

export function openOrderDetail(numOrden){
  const order=state.allOrders.find(o=>String(o['Num_Orden'])===String(numOrden));
  if(!order) return;
  const slug=s=>(s||'').toLowerCase().replace(/\s+/g,'-');

  const editCart=orderItems(order).map(i=>{
    const menuItem=MENU.find(m=>m.id===i.Producto_Id)||MENU.find(m=>m.name===i.Producto);
    return {
      id:i.Producto_Id,
      name:i.Producto,
      emoji:menuItem?menuItem.emoji:'🍽️',
      price:i.Precio_Unitario,
      qty:i.Cantidad,
    };
  });

  // Store on modal element for access in listeners
  const modal=document.getElementById('modal-detail');
  modal._editCart=editCart;
  modal._numOrden=numOrden;

  // Header
  document.getElementById('detail-num').textContent  =`#${String(order['Num_Orden']||'').padStart(4,'0')}`;
  const fechaInp=document.getElementById('edit-fecha');
  const horaInp=document.getElementById('edit-hora');
  if(fechaInp) fechaInp.value=toYmd(order['Fecha'])||'';
  if(horaInp) horaInp.value=toHms(order['Hora'])||'';
  const badge=document.getElementById('detail-badge');
  badge.textContent=order['Estado']||''; badge.className=`badge badge-${slug(order['Estado'])}`;

  // Fields
  document.getElementById('edit-cliente').value    =order['Cliente']||'';
  document.getElementById('edit-dir').value        =order['Direccion']||order['Telefono']||'';
  document.getElementById('edit-pago').value       =order['Metodo_Pago']||'Efectivo';
  document.getElementById('edit-comentarios').value=order['Comentarios']||'';
  document.getElementById('edit-ajuste').value     =order['Ajuste']||'';
  const recFill=parsePesoOptional(order['Recibido']);
  const recInp=document.getElementById('edit-recibido');
  if(recInp) recInp.value=recFill==null?'':String(recFill);

  const sel=document.getElementById('detail-estado-select');
  sel.innerHTML=ESTADOS.map(e=>`<option value="${e}" ${e===order['Estado']?'selected':''}>${e}</option>`).join('');

  // Render edit cart
  refreshEditCart();
  // Render menu picker inside modal
  renderModalMenuPicker();

  modal.classList.remove('hidden');
}

export function refreshEditCart(){
  const modal=document.getElementById('modal-detail');
  const editCart=modal._editCart||[];
  const el=document.getElementById('edit-cart-items');
  el.innerHTML=buildEditCartHtml(editCart);

  // Recalc total
  const ajuste=parseFloat(document.getElementById('edit-ajuste').value)||0;
  const sub=editCart.reduce((s,c)=>s+c.price*c.qty,0);
  const total=peso(Math.max(0,sub+ajuste));
  document.getElementById('edit-subtotal').textContent=fmtMoney(sub);
  document.getElementById('edit-total-calc').textContent=fmtMoney(total);
  updateEditCashUI();

  // Bindings
  el.querySelectorAll('.edit-qty-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const idx=parseInt(btn.dataset.idx);
      editCart[idx].qty+=parseInt(btn.dataset.delta);
      if(editCart[idx].qty<=0) editCart.splice(idx,1);
      refreshEditCart();
    });
  });
  el.querySelectorAll('.edit-del-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ editCart.splice(parseInt(btn.dataset.idx),1); refreshEditCart(); });
  });
}

export function renderModalMenuPicker(){
  const grid=document.getElementById('edit-menu-grid');
  if(!grid) return;
  grid.innerHTML=MENU.map(item=>`
    <button class="menu-item-btn edit-add-item" data-id="${item.id}" style="padding:.3rem .4rem">
      <span style="font-size:1.1rem">${item.emoji}</span>
      <span style="font-size:9px;line-height:1.2">${escHtml(item.name)}</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--green)">${fmtMoney(item.price)}</span>
    </button>`).join('');
  grid.querySelectorAll('.edit-add-item').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const modal=document.getElementById('modal-detail');
      const editCart=modal._editCart;
      const item=MENU.find(i=>i.id===btn.dataset.id); if(!item) return;
      const ex=editCart.find(c=>c.name===item.name);
      if(ex) ex.qty++; else editCart.push({id:item.id,name:item.name,emoji:item.emoji,price:item.price,qty:1});
      refreshEditCart();
    });
  });
}

export function initOrderDetailModal(){
  const modal=document.getElementById('modal-detail');
  document.getElementById('btn-detail-close').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });

  // Recalc when ajuste changes
  document.getElementById('edit-ajuste').addEventListener('input',refreshEditCart);
  const editPago=document.getElementById('edit-pago');
  if(editPago) editPago.addEventListener('change',updateEditCashUI);
  const editRec=document.getElementById('edit-recibido');
  if(editRec) editRec.addEventListener('input',updateEditCashUI);
  document.querySelectorAll('.edit-cash-quick').forEach(btn=>{
    btn.addEventListener('click',()=>applyCashQuick('edit-recibido', btn.dataset.cash));
  });
  document.getElementById('btn-detail-copiar-ticket')?.addEventListener('click',()=>copyTicketForClient(collectEditOrderTicket()));

  // Menu search inside modal
  const msearch=document.getElementById('edit-menu-search');
  if(msearch){
    msearch.addEventListener('input',()=>{
      const q=msearch.value.toLowerCase();
      document.querySelectorAll('.edit-add-item').forEach(btn=>{
        const name=btn.querySelector('span:nth-child(2)')?.textContent?.toLowerCase()||'';
        btn.style.display=name.includes(q)?'':'none';
      });
    });
  }

  // SAVE
  document.getElementById('btn-detail-save-all').addEventListener('click',async()=>{
    const numOrden=modal._numOrden;
    const order=state.allOrders.find(o=>String(o['Num_Orden'])===String(numOrden));
    if(!order){ toast('Orden no encontrada','error'); return; }
    const prev=snapshotOrderInv(order);
    const editCart=modal._editCart||[];
    const ajuste=parseFloat(document.getElementById('edit-ajuste').value)||0;
    const sub=editCart.reduce((s,c)=>s+c.price*c.qty,0);

    order['Cliente']    =document.getElementById('edit-cliente').value.trim();
    order['Direccion']  =document.getElementById('edit-dir').value.trim();
    order['Metodo_Pago']=document.getElementById('edit-pago').value;
    order['Comentarios']=document.getElementById('edit-comentarios').value.trim();
    order['Ajuste']     =ajuste;
    order['Total']      =peso(Math.max(0,sub+ajuste));
    if(order['Metodo_Pago']==='Efectivo'){
      const cash=cashBreakdown(order['Total'], parsePesoOptional(document.getElementById('edit-recibido')?.value));
      if(cash.empty){ order['Recibido']=''; order['Cambio']=''; }
      else { order['Recibido']=cash.recibido; order['Cambio']=cash.cambio; }
    } else { order['Recibido']=''; order['Cambio']=''; }
    const fecha=toYmd(document.getElementById('edit-fecha')?.value);
    if(!fecha){ toast('Pon una fecha válida','error'); return; }
    order['Fecha']=fecha;
    order['Estado']     =document.getElementById('detail-estado-select').value;
    setOrderItems(order, editCart.map(c=>({
      Producto_Id:c.id||'', Producto:c.name, Cantidad:c.qty, Precio_Unitario:c.price,
    })));

    try{
      const invRes=syncOrderInventory(order,{prev});
      await saveOrder(order);
      toast(`✔ Orden #${String(numOrden).padStart(4,'0')} actualizada`,'success');
      notifyInventoryResult(invRes);
      modal.classList.add('hidden'); refreshDashboard(); renderOrdersTable(); renderInventory();
    }catch(e){ toast('Error: '+e.message,'error'); }
  });

  // DELETE ORDER
  document.getElementById('btn-detail-delete').addEventListener('click',async()=>{
    const numOrden=modal._numOrden;
    if(!confirm(`¿Eliminar la orden #${String(numOrden).padStart(4,'0')}? Esta acción no se puede deshacer.`)) return;
    const order=state.allOrders.find(o=>String(o['Num_Orden'])===String(numOrden));
    if(order) syncOrderInventory(order,{deleted:true, prev:snapshotOrderInv(order)});
    state.allOrders=state.allOrders.filter(o=>String(o['Num_Orden'])!==String(numOrden));
    try{
      await deleteOrder(numOrden);
      toast(`🗑️ Orden #${String(numOrden).padStart(4,'0')} eliminada`,'info');
      modal.classList.add('hidden'); refreshDashboard(); renderOrdersTable(); renderInventory();
    }catch(e){ toast('Error: '+e.message,'error'); }
  });
}

export function badgeClass(e){ return `badge badge-${(e||'').toLowerCase().replace(/\s+/g,'-')}`; }

export function renderOrdersStats(){
  const todayStr=today();
  const todayO=state.allOrders.filter(o=>String(o['Fecha']).startsWith(todayStr));
  const ventas=todayO
    .filter(o=>o['Estado']!=='Cancelada')
    .reduce((s,o)=>s+(parseFloat(o['Total'])||0),0);
  document.getElementById('qs-ordenes').textContent  =todayO.length;
  document.getElementById('qs-ventas').textContent   =fmtMoney(ventas);
  const qsCaja=document.getElementById('qs-caja');
  if(qsCaja) qsCaja.textContent=fmtMoney(todayCashInDrawer());
  document.getElementById('qs-pend').textContent     =todayO.filter(o=>o['Estado']==='Pendiente').length;
  document.getElementById('qs-prep').textContent     =todayO.filter(o=>o['Estado']==='Preparando').length;
  document.getElementById('qs-entregadas').textContent=todayO.filter(o=>o['Estado']==='Entregada').length;
}

export function renderOrdersTable(){
  renderOrdersStats();
  const tbody=document.getElementById('ordenes-tbody');
  const fecha =document.getElementById('filter-fecha').value;
  const estado=document.getElementById('filter-estado').value;
  const buscar=(document.getElementById('filter-buscar')?.value||'').trim().toLowerCase();

  let orders=[...state.allOrders];
  if(fecha)  orders=orders.filter(o=>String(o['Fecha']).startsWith(fecha));
  if(estado) orders=orders.filter(o=>o['Estado']===estado);
  if(buscar) orders=orders.filter(o=>
    (o['Cliente']||'').toLowerCase().includes(buscar)||
    (o['Num_Orden']+'').includes(buscar)||
    (o['Productos']||'').toLowerCase().includes(buscar));
  orders.sort((a,b)=>(parseInt(b['Num_Orden'])||0)-(parseInt(a['Num_Orden'])||0));

  if(!orders.length){
    tbody.innerHTML='<tr><td colspan="8" class="empty-list">Sin órdenes para este filtro</td></tr>'; return;
  }
  tbody.innerHTML=orders.map(o=>{
    const rt=relTime(o['Fecha'],o['Hora']);
    const estadoOpts=ESTADOS.map(e=>`<option value="${e}" ${e===o['Estado']?'selected':''}>${e}</option>`).join('');
    const com=o['Comentarios']?`<div class="row-comment">💬 ${escHtml(o['Comentarios'])}</div>`:'';
    return `
      <tr class="orden-row" data-orden="${o['Num_Orden']}">
        <td class="col-num">#${String(o['Num_Orden']||'').padStart(4,'0')}</td>
        <td><div>${o['Fecha']||''}</div>
          ${o['Estado']==='Entregada'||o['Estado']==='Cancelada' ? '' :
            `<span class="rel-time ${rt.cls}" data-fecha="${o['Fecha']}" data-hora="${o['Hora']}">${rt.label}</span>`}
        </td>
        <td><div class="col-cliente-name">${escHtml(o['Cliente']||'')}</div>${com}</td>
        <td class="col-productos">${escHtml(o['Productos']||'')}</td>
        <td class="col-total">${fmtMoney(o['Total']||0)}</td>
        <td>${escHtml(o['Metodo_Pago']||'')}${
          o['Metodo_Pago']==='Efectivo' && parsePesoOptional(o['Cambio'])!=null
            ? `<div class="cash-badge">Cambio ${fmtMoney(parsePesoOptional(o['Cambio']))}</div>` : ''
        }</td>
        <td class="col-status" onclick="event.stopPropagation()">
          <select class="status-inline-select ${badgeClass(o['Estado'])}" data-orden="${o['Num_Orden']}">
            ${estadoOpts}
          </select>
        </td>
        <td onclick="event.stopPropagation()">
          <button class="btn-edit-row" data-orden="${o['Num_Orden']}" title="Editar">✏️</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.orden-row').forEach(row=>row.addEventListener('click',()=>openOrderDetail(row.dataset.orden)));
  tbody.querySelectorAll('.status-inline-select').forEach(sel=>{
    sel.addEventListener('change',async()=>{ sel.className=`status-inline-select ${badgeClass(sel.value)}`; await updateOrderStatus(sel.dataset.orden,sel.value); });
  });
  tbody.querySelectorAll('.btn-edit-row').forEach(btn=>btn.addEventListener('click',()=>openOrderDetail(btn.dataset.orden)));
}

export function initOrdersFilter(){
  document.getElementById('filter-fecha').value=today();
  ['filter-fecha','filter-estado','filter-buscar'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.addEventListener('input',renderOrdersTable); el.addEventListener('change',renderOrdersTable); }
  });
  document.getElementById('btn-reload').addEventListener('click',reloadData);
  document.getElementById('btn-clear-date').addEventListener('click',()=>{
    document.getElementById('filter-fecha').value=''; renderOrdersTable();
  });
}
