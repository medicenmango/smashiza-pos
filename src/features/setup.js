import { refreshDashboard } from './dashboard.js';
import { renderInventory } from './inventario.js';
import { renderMenuEditor, refreshCategoryLabels } from './menu-editor.js';
import { renderMenuGrid, updateOrderNumBadge } from './nueva-orden.js';
import { renderOrdersTable } from './ordenes.js';
import { state } from '../state.js';
import { pickFile, handleFromDrop, loadExcel, startDemoMode, createNewExcel } from '../storage/excel.js';
import { toast } from '../ui/toast.js';
import { today } from '../utils/format.js';

export function setupScreen(){
  const dz=document.getElementById('drop-zone');
  const st=document.getElementById('setup-status');
  function showSt(msg,type){ st.textContent=msg; st.className=`status-msg ${type}`; st.classList.remove('hidden'); }
  async function handleFile(h){
    try{ showSt('Cargando...','info'); await loadExcel(h);
      showSt(`✔ ${state.fileName} cargado.`,'success');
      setTimeout(goToApp,700);
    }catch(e){ showSt('Error: '+e.message,'error'); }
  }
  dz.addEventListener('click',async()=>{ const h=await pickFile(); if(h) await handleFile(h); });
  dz.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); dz.click(); } });
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop',async e=>{
    e.preventDefault(); dz.classList.remove('drag-over');
    const h=await handleFromDrop(e.dataTransfer); if(h) await handleFile(h);
  });
  document.getElementById('btn-create-excel').addEventListener('click',e=>{e.preventDefault();createNewExcel();});
  const demoBtn=document.getElementById('btn-demo-mode');
  if(demoBtn) demoBtn.addEventListener('click',e=>{ e.preventDefault(); startDemoMode(); });
}

export function goToApp(){
  document.getElementById('screen-setup').classList.replace('active','hidden');
  document.getElementById('screen-app').classList.replace('hidden','active');
  // Pre-select today in dashboard
  state.dashSelectedDates = new Set([today()]);
  refreshDashboard(); renderOrdersTable(); updateOrderNumBadge();
  renderInventory(); renderMenuGrid(); renderMenuEditor(); refreshCategoryLabels();
}

export function initChangeExcel(){
  const modal=document.getElementById('modal-change');
  document.getElementById('btn-change-excel').addEventListener('click',()=>modal.classList.remove('hidden'));
  document.getElementById('btn-modal-cancel').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  async function changeFile(h){
    try{ await loadExcel(h); modal.classList.add('hidden');
      refreshDashboard(); renderOrdersTable(); updateOrderNumBadge(); renderInventory();
      toast('✔ Excel cambiado: '+state.fileName,'success');
    }catch(e){ toast('Error: '+e.message,'error'); }
  }
  const mdz=document.getElementById('modal-drop-zone');
  mdz.addEventListener('click',async()=>{ const h=await pickFile(); if(h) await changeFile(h); });
}
