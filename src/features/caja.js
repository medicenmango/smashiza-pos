import { expectedCash, shiftDifference, shiftSalesTotals } from '../domain/cash.js';
import { MENU } from '../domain/menu.js';
import { state } from '../state.js';
import {
  closeCashShift, getOpenCashShift, listBusinessMembers, listCashShifts, openCashShift,
} from '../storage/supabase.js';
import { toast } from '../ui/toast.js';
import { escHtml, fmtMoney, peso } from '../utils/format.js';

let openShift=null;
let recentShifts=[];
let lastClosed=null;

function canUseCaja(){
  return !!state.cloud && !!state.businessId;
}

function fmtWhen(iso){
  if(!iso) return '—';
  try{
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-MX', {
      dateStyle:'short', timeStyle:'short',
    });
  }catch(_){
    return String(iso);
  }
}

function liveSales(){
  if(!openShift?.openedAt){
    return { salesEfectivo:0, salesTransferencia:0, salesTarjeta:0, orderCount:0, other:0 };
  }
  return shiftSalesTotals(state.allOrders, openShift.openedAt, new Date());
}

function renderChecklist(){
  const el=document.getElementById('caja-checklist');
  if(!el) return;
  const hasProduct=MENU.length>0;
  const members=state._cajaMembersCount;
  const hasCashier=members==null?null:members>=2 || state.businessRole==='cashier';
  const items=[
    { ok:!!state.businessId, label:'Negocio activo' },
    { ok:hasProduct, label:'Menú con al menos un producto' },
    {
      ok:hasCashier===null?true:!!hasCashier,
      label:hasCashier
        ? 'Equipo listo (dueño + cajero u operas como cajero)'
        : 'Opcional: crea un cajero en NEGOCIO → EQUIPO',
    },
  ];
  el.innerHTML=items.map(i=>`
    <li class="caja-check ${i.ok?'ok':'warn'}">${i.ok?'✔':'○'} ${escHtml(i.label)}</li>
  `).join('');
}

function renderOpenPanel(){
  const closed=document.getElementById('caja-closed-panel');
  const open=document.getElementById('caja-open-panel');
  if(closed) closed.classList.toggle('hidden', !!openShift);
  if(open) open.classList.toggle('hidden', !openShift);

  if(!openShift){
    const opening=document.getElementById('caja-opening-cash');
    if(opening && document.activeElement!==opening) opening.value=opening.value||'0';
    return;
  }

  const sales=liveSales();
  const expected=expectedCash(openShift.openingCash, sales.salesEfectivo);
  const countedEl=document.getElementById('caja-counted-cash');
  const counted=countedEl&&document.activeElement===countedEl
    ? peso(countedEl.value)
    : peso(countedEl?.value);
  const diff=shiftDifference(counted, expected);

  const set=(id, text)=>{ const n=document.getElementById(id); if(n) n.textContent=text; };
  set('caja-opened-at', fmtWhen(openShift.openedAt));
  set('caja-opening-display', fmtMoney(openShift.openingCash));
  set('caja-sales-efectivo', fmtMoney(sales.salesEfectivo));
  set('caja-sales-transferencia', fmtMoney(sales.salesTransferencia));
  set('caja-sales-tarjeta', fmtMoney(sales.salesTarjeta));
  set('caja-order-count', String(sales.orderCount));
  set('caja-expected', fmtMoney(expected));
  set('caja-diff', fmtMoney(diff));
  const diffEl=document.getElementById('caja-diff');
  if(diffEl){
    diffEl.classList.toggle('caja-diff-pos', diff>0);
    diffEl.classList.toggle('caja-diff-neg', diff<0);
    diffEl.classList.toggle('caja-diff-zero', diff===0);
  }
}

function renderRecent(){
  const el=document.getElementById('caja-recent-list');
  if(!el) return;
  const rows=recentShifts.filter(s=>s.closedAt);
  if(!rows.length){
    el.innerHTML='<li class="setup-hint">Aún no hay cortes cerrados.</li>';
    return;
  }
  el.innerHTML=rows.slice(0,8).map(s=>{
    const diff=s.difference??0;
    const cls=diff===0?'caja-diff-zero':diff>0?'caja-diff-pos':'caja-diff-neg';
    return `<li class="caja-recent-row">
      <span>${escHtml(fmtWhen(s.closedAt))}</span>
      <span>Esp ${fmtMoney(s.expectedCash)} · Cont ${fmtMoney(s.countedCash)}</span>
      <span class="${cls}">Δ ${fmtMoney(diff)}</span>
    </li>`;
  }).join('');
}

function renderLastClosed(){
  const box=document.getElementById('caja-last-closed');
  if(!box) return;
  if(!lastClosed){
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML=`<strong>Último corte</strong>
    · Efec ${fmtMoney(lastClosed.salesEfectivo)}
    · Transf ${fmtMoney(lastClosed.salesTransferencia)}
    · Tarj ${fmtMoney(lastClosed.salesTarjeta)}
    · Esperado ${fmtMoney(lastClosed.expectedCash)}
    · Contado ${fmtMoney(lastClosed.countedCash)}
    · <span class="${(lastClosed.difference||0)===0?'caja-diff-zero':(lastClosed.difference||0)>0?'caja-diff-pos':'caja-diff-neg'}">Δ ${fmtMoney(lastClosed.difference)}</span>`;
}

export async function renderCajaTab(){
  const root=document.getElementById('tab-caja');
  if(!root) return;
  const needCloud=root.querySelector('.caja-cloud-only');
  const editor=root.querySelector('.caja-editor');
  if(!canUseCaja()){
    needCloud?.classList.remove('hidden');
    editor?.classList.add('hidden');
    return;
  }
  needCloud?.classList.add('hidden');
  editor?.classList.remove('hidden');

  try{
    openShift=await getOpenCashShift();
    recentShifts=await listCashShifts({ limit:10 });
    if(!lastClosed){
      lastClosed=recentShifts.find(s=>s.closedAt)||null;
    }
    try{
      const members=await listBusinessMembers();
      state._cajaMembersCount=members.length;
    }catch(_){
      state._cajaMembersCount=null;
    }
  }catch(err){
    toast('Error al cargar caja: '+err.message,'error');
    openShift=null;
    recentShifts=[];
  }

  renderChecklist();
  renderOpenPanel();
  renderRecent();
  renderLastClosed();
}

export function initCajaTab(){
  document.getElementById('caja-open-btn')?.addEventListener('click',async()=>{
    if(!canUseCaja()){ toast('Corte de caja solo en modo nube.','error'); return; }
    const raw=document.getElementById('caja-opening-cash')?.value;
    const opening=peso(raw);
    if(opening<0){ toast('El fondo no puede ser negativo.','error'); return; }
    const btn=document.getElementById('caja-open-btn');
    if(btn) btn.disabled=true;
    try{
      openShift=await openCashShift({ openingCash:opening });
      lastClosed=null;
      toast('✔ Turno abierto.','success');
      await renderCajaTab();
    }catch(err){
      toast('Error: '+err.message,'error');
    }finally{
      if(btn) btn.disabled=false;
    }
  });

  document.getElementById('caja-counted-cash')?.addEventListener('input',()=>{
    renderOpenPanel();
  });

  document.getElementById('caja-refresh-sales')?.addEventListener('click',()=>{
    renderOpenPanel();
    toast('Totales actualizados.','info');
  });

  document.getElementById('caja-close-btn')?.addEventListener('click',async()=>{
    if(!canUseCaja()||!openShift){ toast('No hay turno abierto.','error'); return; }
    const counted=peso(document.getElementById('caja-counted-cash')?.value);
    if(counted<0){ toast('El contado no puede ser negativo.','error'); return; }
    const sales=liveSales();
    const expected=expectedCash(openShift.openingCash, sales.salesEfectivo);
    const diff=shiftDifference(counted, expected);
    const notes=(document.getElementById('caja-notes')?.value||'').trim();
    const warn=diff===0
      ? `¿Cerrar turno?\nEsperado ${fmtMoney(expected)} = contado.`
      : `¿Cerrar turno?\nEsperado ${fmtMoney(expected)} · Contado ${fmtMoney(counted)} · Diferencia ${fmtMoney(diff)}\n(No se borran órdenes.)`;
    if(!confirm(warn)) return;

    const btn=document.getElementById('caja-close-btn');
    if(btn) btn.disabled=true;
    try{
      const closed=await closeCashShift({
        countedCash:counted,
        salesEfectivo:sales.salesEfectivo,
        salesTransferencia:sales.salesTransferencia,
        salesTarjeta:sales.salesTarjeta,
        notes,
      });
      lastClosed=closed;
      openShift=null;
      const notesEl=document.getElementById('caja-notes');
      const countedEl=document.getElementById('caja-counted-cash');
      if(notesEl) notesEl.value='';
      if(countedEl) countedEl.value='';
      toast(`✔ Corte cerrado · Δ ${fmtMoney(closed.difference)}`,'success');
      await renderCajaTab();
    }catch(err){
      toast('Error: '+err.message,'error');
    }finally{
      if(btn) btn.disabled=false;
    }
  });
}
