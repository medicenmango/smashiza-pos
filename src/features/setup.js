import { refreshDashboard } from './dashboard.js';
import { renderInventory } from './inventario.js';
import { renderMenuEditor, refreshCategoryLabels } from './menu-editor.js';
import { renderMenuGrid, updateOrderNumBadge } from './nueva-orden.js';
import { renderOrdersTable } from './ordenes.js';
import { state } from '../state.js';
import { pickFile, handleFromDrop, loadExcel, loadDemoWorkbook, createNewExcel, canWriteHandle, loadWorkbookForImport, downloadBackup } from '../storage/excel.js';
import { onSyncChange } from '../storage/events.js';
import { onDataLoaded, useBackend } from '../storage/index.js';
import { currentUser, signIn, signOut, countRows, loadFromSupabase, importStateToSupabase, uploadMenuCatalog,
  isNetworkError, hasCache, loadFromCache, syncStatus, startAutoSync } from '../storage/supabase.js';
import { toast } from '../ui/toast.js';
import { today } from '../utils/format.js';

function updateWriteMode(){
  const el=document.getElementById('excel-write-mode');
  if(!el) return;
  if(state.cloud){
    const { pending, offline }=syncStatus();
    if(offline){
      el.textContent=pending?`📴 SIN CONEXIÓN · ${pending} POR SUBIR`:'📴 SIN CONEXIÓN';
      el.className='file-write-mode warn';
    } else if(pending){
      el.textContent=`⏳ SUBIENDO ${pending}`;
      el.className='file-write-mode demo';
    } else {
      el.textContent='☁ EN LÍNEA';
      el.className='file-write-mode ok';
    }
    return;
  }
  if(state.demoMode){
    el.textContent='🎮 MODO PRUEBA';
    el.className='file-write-mode demo';
    return;
  }
  if(canWriteHandle(state.fileHandle)){
    el.textContent='✎ EN ARCHIVO';
    el.className='file-write-mode ok';
  } else {
    el.textContent='⚠ SOLO LECTURA';
    el.className='file-write-mode warn';
  }
}

function onLoaded(){
  renderMenuGrid(); renderMenuEditor(); refreshCategoryLabels();
  document.getElementById('active-filename').textContent=state.fileName;
  document.getElementById('modal-current-file').textContent=state.fileName;
  document.getElementById('file-label').textContent=state.cloud?'USUARIO:':'EXCEL:';
  document.getElementById('btn-change-excel').classList.toggle('hidden', state.cloud);
  document.getElementById('btn-backup').classList.toggle('hidden', !state.cloud);
  document.getElementById('btn-logout').classList.toggle('hidden', !state.cloud);
  updateWriteMode();
}

function statusFn(id){
  const st=document.getElementById(id);
  return (msg,type)=>{ st.textContent=msg; st.className=`status-msg ${type}`; st.classList.remove('hidden'); };
}

function initCloudLogin(){
  const showSt=statusFn('login-status');
  const form=document.getElementById('login-form');
  const importPanel=document.getElementById('import-panel');

  async function enterOffline(){
    useBackend('supabase');
    await loadFromCache();
    goToApp();
    toast('📴 Sin conexión: trabajas con los datos guardados en este dispositivo. Lo nuevo se sube solo al volver internet.','info',8000);
  }

  async function enterCloud(){
    useBackend('supabase');
    showSt('Cargando datos de la nube...','info');
    try{
      if(await countRows('orders')===0 && await countRows('menu_items')===0){
        form.classList.add('hidden');
        importPanel.classList.remove('hidden');
        showSt('✔ Sesión iniciada. La base está vacía.','success');
        return;
      }
      await loadFromSupabase();
    }catch(e){
      if(isNetworkError(e) && await hasCache()) return enterOffline();
      throw e;
    }
    showSt('✔ Datos cargados.','success');
    goToApp();
  }

  async function importExcel(handle){
    try{
      showSt('Leyendo Excel...','info');
      await loadWorkbookForImport(handle);
      useBackend('supabase');
      showSt(`Subiendo ${state.allOrders.length} órdenes a la nube...`,'info');
      const r=await importStateToSupabase();
      await loadFromSupabase();
      const skipped=r.skipped.length?` · ${r.skipped.length} omitidas (sin fecha o número repetido): ${r.skipped.slice(0,10).join(', ')}`:'';
      showSt(`✔ Importado: ${r.orders} órdenes, ${r.items} productos vendidos, ${r.movements} movimientos${skipped}`,'success');
      if(r.skipped.length) console.warn('[Smashiza import] órdenes omitidas:', r.skipped);
      setTimeout(goToApp, 1500);
    }catch(e){ showSt('Error al importar: '+e.message,'error'); }
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=document.getElementById('btn-login');
    btn.disabled=true;
    try{
      showSt('Entrando...','info');
      await signIn(document.getElementById('login-email').value.trim(), document.getElementById('login-password').value);
      document.getElementById('login-password').value='';
      await enterCloud();
    }catch(e){
      const msg=/invalid login credentials/i.test(e.message)?'Correo o contraseña incorrectos.':e.message;
      showSt('Error: '+msg,'error');
    }finally{ btn.disabled=false; }
  });

  const idz=document.getElementById('import-drop-zone');
  idz.addEventListener('click',async()=>{ const h=await pickFile(); if(h) await importExcel(h); });
  idz.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); idz.click(); } });
  idz.addEventListener('dragover',e=>{ e.preventDefault(); idz.classList.add('drag-over'); });
  idz.addEventListener('dragleave',()=>idz.classList.remove('drag-over'));
  idz.addEventListener('drop',async e=>{
    e.preventDefault(); idz.classList.remove('drag-over');
    const h=await handleFromDrop(e.dataTransfer); if(h) await importExcel(h);
  });

  document.getElementById('btn-start-empty').addEventListener('click',async()=>{
    if(!confirm('¿Empezar con la base vacía? Se sube el menú que tiene este navegador. Después ya no podrás importar tu Excel desde aquí.')) return;
    try{
      await loadFromSupabase();
      await uploadMenuCatalog();
      goToApp();
    }catch(e){ showSt('Error: '+e.message,'error'); }
  });

  document.getElementById('btn-backup').addEventListener('click',()=>{
    downloadBackup();
    toast('📥 Respaldo descargado.','success');
  });
  document.getElementById('btn-logout').addEventListener('click',async()=>{
    const { pending }=syncStatus();
    const warn=pending
      ? `⚠️ Hay ${pending} cambio(s) sin subir a la nube. Si cierras sesión SE PIERDEN.\n\n¿Cerrar sesión de todos modos?`
      : '¿Cerrar sesión en este dispositivo? Se borran los datos guardados en este dispositivo.';
    if(!confirm(warn)) return;
    await signOut();
    location.reload();
  });

  onSyncChange(updateWriteMode);
  startAutoSync();

  (async()=>{
    if(!navigator.onLine && await hasCache()) return enterOffline();
    if(await currentUser()) return enterCloud();
  })().catch(e=>showSt('No se pudo conectar: '+e.message+' — recarga para reintentar.','error'));
}

export function setupScreen(){
  onDataLoaded(onLoaded);
  initCloudLogin();
  const dz=document.getElementById('drop-zone');
  const showSt=statusFn('setup-status');
  async function handleFile(h){
    try{ showSt('Cargando...','info'); useBackend('excel'); await loadExcel(h);
      showSt(`✔ ${state.fileName} cargado.`,'success');
      setTimeout(goToApp,700);
    }catch(e){ showSt('Error: '+e.message,'error'); }
  }
  async function startDemoMode(){
    try{
      showSt('Cargando modo prueba...','info');
      useBackend('excel');
      await loadDemoWorkbook();
      showSt('✔ Modo prueba listo.','success');
      setTimeout(()=>{
        goToApp();
        toast('Modo prueba lleno: menú, recetas, costos, inventario, clientes y órdenes de muestra. No se guarda en tu Excel.','info',8000);
      },400);
    }catch(e){ showSt('Error: '+e.message,'error'); }
  }
  async function startNewExcel(){
    useBackend('excel');
    if(!await createNewExcel()) return;
    goToApp();
    toast('✔ Excel creado. Guárdalo en OneDrive si aún no está ahí.','success',5000);
  }
  dz.addEventListener('click',async()=>{ const h=await pickFile(); if(h) await handleFile(h); });
  dz.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); dz.click(); } });
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop',async e=>{
    e.preventDefault(); dz.classList.remove('drag-over');
    const h=await handleFromDrop(e.dataTransfer); if(h) await handleFile(h);
  });
  document.getElementById('btn-create-excel').addEventListener('click',e=>{e.preventDefault();startNewExcel();});
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
