import { isOwner, isOwnerOnlyTab } from '../auth/roles.js';
import { renderCostEditor, renderBA } from './analisis.js';
import { renderCajaTab } from './caja.js';
import { renderClientsTab } from './clientes.js';
import { refreshDashboard } from './dashboard.js';
import { renderInventory } from './inventario.js';
import { renderMenuEditor } from './menu-editor.js';
import { renderNegocioTab } from './negocio.js';
import { stampNewOrderWhen, renderLiveQueue } from './nueva-orden.js';
import { renderOrdersTable } from './ordenes.js';
import { toast } from '../ui/toast.js';

/** Oculta pestañas de dueño para cajero; si estaba en una, salta a nueva orden. */
export function applyRoleNav(){
  const owner=isOwner();
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    const tab=btn.dataset.tab;
    const ownerOnly=isOwnerOnlyTab(tab);
    btn.classList.toggle('hidden', ownerOnly && !owner);
    btn.toggleAttribute('disabled', ownerOnly && !owner);
  });
  const active=document.querySelector('.nav-btn.active');
  if(active && isOwnerOnlyTab(active.dataset.tab) && !owner){
    const fallback=document.querySelector('.nav-btn[data-tab="tab-nueva-orden"]');
    if(fallback) fallback.click();
  }
}

export function initNav(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(isOwnerOnlyTab(btn.dataset.tab) && !isOwner()){
        toast('Solo el dueño puede abrir esa sección.','error');
        return;
      }
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t=>{t.classList.remove('active');t.classList.add('hidden');});
      btn.classList.add('active');
      const tab=document.getElementById(btn.dataset.tab);
      if(!tab) return;
      tab.classList.remove('hidden'); tab.classList.add('active');
      if(btn.dataset.tab==='tab-dashboard') refreshDashboard();
      if(btn.dataset.tab==='tab-nueva-orden'){
        renderLiveQueue();
        stampNewOrderWhen();
      }
      if(btn.dataset.tab==='tab-ordenes')   renderOrdersTable();
      if(btn.dataset.tab==='tab-caja')      renderCajaTab();
      if(btn.dataset.tab==='tab-menu')      renderMenuEditor();
      if(btn.dataset.tab==='tab-clientes')  renderClientsTab();
      if(btn.dataset.tab==='tab-analisis'){ renderCostEditor(); renderBA(); }
      if(btn.dataset.tab==='tab-inventario') renderInventory();
      if(btn.dataset.tab==='tab-negocio') renderNegocioTab();
    });
  });
}

export function goToInventarioTab(){
  if(!isOwner()){
    toast('Solo el dueño puede abrir inventario.','error');
    return;
  }
  const btn=document.querySelector('.nav-btn[data-tab="tab-inventario"]');
  if(btn) btn.click();
}
