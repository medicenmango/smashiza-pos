import { isOwner } from '../auth/roles.js';
import { buildReadyChecklist, readyBannerMessage } from '../domain/ready.js';
import { state } from '../state.js';
import { getOpenCashShift, listBusinessMembers } from '../storage/supabase.js';
import { escHtml } from '../utils/format.js';

let loading=false;

function paintBanner(check){
  const el=document.getElementById('ready-banner');
  if(!el) return;
  if(!state.cloud || !state.businessId || !isOwner()){
    el.classList.add('hidden');
    el.innerHTML='';
    return;
  }
  const msg=readyBannerMessage(check);
  if(!msg){
    el.classList.add('hidden');
    el.classList.remove('ready-banner-warn');
    el.innerHTML=`<span class="ready-banner-msg">✔ Listo para el turno (menú, marca, caja).</span>
      <button type="button" class="btn-secondary btn-inline" data-go-caja>Ver CAJA</button>`;
    // keep subtle success optional — hide when all ok to avoid noise
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.classList.add('ready-banner-warn');
  const details=check.missingRequired.map(i=>`<li>${escHtml(i.label)}</li>`).join('');
  el.innerHTML=`
    <div class="ready-banner-body">
      <strong class="ready-banner-msg">${escHtml(msg)}</strong>
      <ul class="ready-banner-list">${details}</ul>
      <p class="ready-banner-foot">No bloquea ventas — es un recordatorio para el dueño.</p>
    </div>
    <div class="ready-banner-actions">
      <button type="button" class="btn-secondary btn-inline" data-go-caja>Ir a CAJA</button>
      <button type="button" class="btn-secondary btn-inline" data-go-negocio>NEGOCIO</button>
    </div>`;
}

/** Pinta el banner del dashboard con datos ya conocidos (p.ej. tras renderCajaTab). */
export function refreshReadyBanner({ openShift, membersCount }={}){
  const shift=openShift!==undefined?openShift:state._openCashShift;
  const members=membersCount!==undefined?membersCount:state._cajaMembersCount;
  const check=buildReadyChecklist({ openShift:shift, membersCount:members });
  paintBanner(check);
}

/** Carga turno abierto + miembros y actualiza banner (dashboard / home). */
export async function loadReadyBanner(){
  const el=document.getElementById('ready-banner');
  if(!el) return;
  if(!state.cloud || !state.businessId || !isOwner()){
    el.classList.add('hidden');
    el.innerHTML='';
    return;
  }
  if(loading) return;
  loading=true;
  try{
    let openShift=state._openCashShift;
    try{ openShift=await getOpenCashShift(); state._openCashShift=openShift; }
    catch(_){ /* checklist parcial */ }
    if(state._cajaMembersCount==null){
      try{
        const members=await listBusinessMembers();
        state._cajaMembersCount=members.length;
      }catch(_){
        state._cajaMembersCount=null;
      }
    }
    refreshReadyBanner({ openShift, membersCount:state._cajaMembersCount });
  }finally{
    loading=false;
  }
}

export function initReadyBanner(){
  document.getElementById('ready-banner')?.addEventListener('click',e=>{
    const caja=e.target.closest('[data-go-caja]');
    const neg=e.target.closest('[data-go-negocio]');
    if(caja){
      document.querySelector('.nav-btn[data-tab="tab-caja"]')?.click();
      return;
    }
    if(neg){
      document.querySelector('.nav-btn[data-tab="tab-negocio"]')?.click();
    }
  });
}
