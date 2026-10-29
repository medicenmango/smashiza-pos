import { renderCostEditor, renderBA } from './analisis.js';
import { renderClientsTab } from './clientes.js';
import { refreshDashboard } from './dashboard.js';
import { renderInventory } from './inventario.js';
import { renderMenuEditor } from './menu-editor.js';
import { stampNewOrderWhen, renderLiveQueue } from './nueva-orden.js';
import { renderOrdersTable } from './ordenes.js';

export function initNav(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
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
      if(btn.dataset.tab==='tab-menu')      renderMenuEditor();
      if(btn.dataset.tab==='tab-clientes')  renderClientsTab();
      if(btn.dataset.tab==='tab-analisis'){ renderCostEditor(); renderBA(); }
      if(btn.dataset.tab==='tab-inventario') renderInventory();
    });
  });
}

export function goToInventarioTab(){
  const btn=document.querySelector('.nav-btn[data-tab="tab-inventario"]');
  if(btn) btn.click();
}
