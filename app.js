/* ═══════════════════════════════════════════════════════
   LA SMASHIZA RETRO BURGER — POS SYSTEM  v6
   app.js — Lógica completa sin backend
════════════════════════════════════════════════════════ */
'use strict';

// ─────────────────────────────────────────────
// MENÚ DEFAULT
// ─────────────────────────────────────────────
const MENU_DEFAULT = [
  { id:'s1', cat:'smash',    emoji:'🍔', name:'La Master',        price:159 },
  { id:'s2', cat:'smash',    emoji:'🍔', name:'El Santos',         price:159 },
  { id:'s3', cat:'smash',    emoji:'🍔', name:'La de Cajon',       price:159 },
  { id:'s4', cat:'smash',    emoji:'🍔', name:'Un Clasico',        price:159 },
  { id:'s5', cat:'smash',    emoji:'🍔', name:'Paraiso',           price:179 },
  { id:'s6', cat:'smash',    emoji:'🍔', name:'Tocho',             price:179 },
  { id:'s7', cat:'smash',    emoji:'🧀', name:'QuesaBurger',       price:119 },
  { id:'e1', cat:'especial', emoji:'🍟', name:'Algo Tranqui CH',   price:59  },
  { id:'e2', cat:'especial', emoji:'🍟', name:'Algo Tranqui G',    price:89  },
  { id:'e3', cat:'especial', emoji:'🍟', name:'Algo Bello CH',     price:79  },
  { id:'e4', cat:'especial', emoji:'🍟', name:'Algo Bello G',      price:99  },
  { id:'e5', cat:'especial', emoji:'🍟', name:'Las Monchosas CH',  price:109 },
  { id:'e6', cat:'especial', emoji:'🍟', name:'Las Monchosas G',   price:129 },
  { id:'x1', cat:'extras',   emoji:'🥫', name:'Aderezo Especial',  price:15  },
  { id:'x2', cat:'extras',   emoji:'🌶️', name:'Aderezo Jalapeño', price:15  },
  { id:'x3', cat:'extras',   emoji:'🥫', name:'Catsup',            price:15  },
  { id:'x4', cat:'extras',   emoji:'🌶️', name:'Chile en rajas',   price:15  },
  { id:'x5', cat:'extras',   emoji:'🥒', name:'Pepinillos',        price:15  },
  { id:'x6', cat:'extras',   emoji:'🍍', name:'Extra Piña',        price:15  },
  { id:'x7', cat:'extras',   emoji:'🥗', name:'Extra Ranch',       price:15  },
  { id:'x8', cat:'extras',   emoji:'🥓', name:'Extra Tocino',      price:15  },
  { id:'b1', cat:'bebidas',  emoji:'🧃', name:'Boing',             price:25  },
];

const CAT_LABELS = {
  smash:'SMASH BURGERS', especial:'PAPAS',
  extras:'EXTRAS & COMPLEMENTOS', bebidas:'BEBIDAS',
};
const ESTADOS = ['Pendiente','Preparando','Lista','Entregada','Cancelada'];
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ─────────────────────────────────────────────
// MENU PERSISTENCE
// ─────────────────────────────────────────────
function loadMenuFromStorage() {
  try {
    const raw = localStorage.getItem('smashiza_menu_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.cats) Object.keys(parsed.cats).forEach(k => { CAT_LABELS[k] = parsed.cats[k]; });
      return parsed.items || JSON.parse(JSON.stringify(MENU_DEFAULT));
    }
  } catch(_) {}
  return JSON.parse(JSON.stringify(MENU_DEFAULT));
}
function saveMenuToStorage() {
  try {
    localStorage.setItem('smashiza_menu_v2', JSON.stringify({ items: MENU, cats: { ...CAT_LABELS } }));
  } catch(_) {}
}
let MENU = loadMenuFromStorage();

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const state = {
  fileHandle:null, fileName:'', workbook:null, sheetName:'Ordenes',
  allOrders:[], inventory:[], recipes:[], movements:[],
  cart:[], payMethod:'Efectivo', activeCat:'all',
  menuSearch:'', ajuste:0,
  // Dashboard multi-date
  dashSelectedDates: new Set(),
  // Clients sort
  clientsSort: { col:'total', dir:'desc' },
  // Menu item sort order per cat (map cat -> ordered id array)
  menuOrder: JSON.parse(localStorage.getItem('smashiza_menu_order')||'{}'),
  recipeUi: { cat:'all', q:'', open:new Set(), collapsed:{} },
  recipeDrafts: {},
};

const HEADERS = [
  'Num_Orden','Fecha','Hora','Cliente','Direccion',
  'Productos','Cantidades','Comentarios','Metodo_Pago',
  'Ajuste','Total','Recibido','Cambio','Estado'
];
const INV_SHEET='Inventario', REC_SHEET='Recetas', MOV_SHEET='Movimientos';
const INV_HEADERS=['Nombre','Unidad','Stock','Minimo','Ideal','Proveedor','Nota'];
const REC_HEADERS=['Producto','Ingrediente','Cantidad','Unidad'];
const MOV_HEADERS=['Fecha','Hora','Tipo','Ingrediente','Cantidad','Unidad','Num_Orden','Nota'];
const MENU_SHEET='Menu', CAT_SHEET='Categorias', COST_SHEET='Costos', CATALOG_SHEET='Catalogo', PRICE_SHEET='PrecioHistorial';
const MENU_HEADERS=['Id','Categoria','Emoji','Nombre','Precio','Orden'];
const CAT_HEADERS=['Id','Etiqueta'];
const COST_HEADERS=['Producto','Costo'];
const CATALOG_HEADERS=['Producto','Emoji','Categoria','EnMenu'];
const PRICE_HEADERS=['Producto','Desde','Precio'];
let catalogCache=null;
let persistMenuTimer=null;

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function pad(n)  { return String(n).padStart(2,'0'); }
function fmtDate(d=new Date()){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtTime(d=new Date()){ return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function toYmd(v){
  if(v==null||v==='') return '';
  if(v instanceof Date && !isNaN(v)) return fmtDate(v);
  if(typeof v==='number' && isFinite(v)){
    if(v>20000 && v<80000){
      const d=new Date(Math.round((v-25569)*86400*1000));
      return isNaN(d)?'':fmtDate(d);
    }
    return '';
  }
  const s=String(v).trim();
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if(dmy) return `${dmy[3]}-${pad(+dmy[2])}-${pad(+dmy[1])}`;
  const d=new Date(s);
  return isNaN(d)?'':fmtDate(d);
}
function toHms(v){
  if(v==null||v==='') return '';
  if(typeof v==='number' && isFinite(v) && v>=0 && v<2){
    const secs=Math.round((v%1)*86400);
    return `${pad(Math.floor(secs/3600)%24)}:${pad(Math.floor((secs%3600)/60))}:${pad(secs%60)}`;
  }
  if(v instanceof Date && !isNaN(v)) return fmtTime(v);
  const s=String(v).trim();
  const m=s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(m) return `${pad(+m[1])}:${m[2]}:${m[3]||'00'}`;
  return '';
}
function stampNewOrderWhen(){
  const now=new Date();
  const f=document.getElementById('f-fecha');
  const h=document.getElementById('f-hora');
  if(f) f.value=fmtDate(now);
  if(h) h.value=`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
function fmtMoney(n){ return '$'+Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function peso(n){ return Math.round(Number(n)||0); }
function parsePesoOptional(v){
  if(v===''||v==null||String(v).trim()==='') return null;
  const n=Number(v); if(!isFinite(n)) return null;
  return Math.round(n);
}
function cashBreakdown(total, recibidoOpt){
  const tot=peso(total);
  if(recibidoOpt==null) return { empty:true, short:tot>0, falta:tot, cambio:null, recibido:null };
  const rec=peso(recibidoOpt);
  if(rec<tot) return { empty:false, short:true, falta:tot-rec, cambio:0, recibido:rec };
  return { empty:false, short:false, falta:0, cambio:rec-tot, recibido:rec };
}
function orderCashIn(o){
  if((o['Metodo_Pago']||'')!=='Efectivo') return 0;
  if(o['Estado']==='Cancelada') return 0;
  const rec=parsePesoOptional(o['Recibido']);
  const cam=parsePesoOptional(o['Cambio']);
  if(rec==null) return peso(o['Total']);
  return rec-Math.max(0, cam==null?0:cam);
}
function todayCashInDrawer(){
  const d=today();
  return state.allOrders.filter(o=>String(o['Fecha']).startsWith(d)).reduce((s,o)=>s+orderCashIn(o),0);
}
function today(){ return fmtDate(); }
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function orderProductSummary(o){
  const names=String(o['Productos']||'').split(' | ').filter(Boolean);
  const qtys=String(o['Cantidades']||'').split(' | ');
  if(!names.length) return 'Sin productos';
  return names.map((n,i)=>{
    const raw=String(qtys[i]||'1').replace(/x$/i,'').trim();
    const q=parseInt(raw,10);
    return `${isFinite(q)&&q>0?q:1}× ${n}`;
  }).join(' · ');
}
function renderLiveQueue(){
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
function relTime(fecha, hora) {
  if (!fecha||!hora) return {label:'—',cls:'time-ok'};
  const dt = new Date(`${fecha}T${hora}`);
  if (isNaN(dt)) return {label:'—',cls:'time-ok'};
  const mins = Math.round((Date.now()-dt)/60000);
  if (mins<0)  return {label:'ahora',cls:'time-ok'};
  if (mins<15) return {label:`${mins}m`,cls:'time-ok'};
  if (mins<25) return {label:`${mins}m ⚠️`,cls:'time-warn'};
  return {label:`${mins}m 🔴`,cls:'time-late'};
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function toast(msg, type='success', ms=3000) {
  const c=document.getElementById('toast-container');
  const el=document.createElement('div');
  el.className=`toast ${type}`; el.textContent=msg; c.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)';
    el.style.transition='all .3s'; setTimeout(()=>el.remove(),350); },ms);
}

// ─────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────
function startClock() {
  const el=document.getElementById('clock');
  const tick=()=>{ const d=new Date(); el.textContent=`${fmtDate(d)}  ${fmtTime(d)}`; };
  tick(); setInterval(tick,1000);
  setInterval(()=>{
    document.querySelectorAll('.rel-time[data-fecha]').forEach(span=>{
      const t=relTime(span.dataset.fecha,span.dataset.hora);
      span.textContent=t.label; span.className=`rel-time ${t.cls}`;
    });
  },30000);
}

// ─────────────────────────────────────────────
// FILE SYSTEM ACCESS
// ─────────────────────────────────────────────
const EXCEL_PICKER_OPTS = {
  id: 'smashiza-ordenes',
  types: [{
    description: 'Excel',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
  }],
  excludeAcceptAllOption: false,
  multiple: false,
};

function canWriteHandle(h){
  return !!(h && typeof h.createWritable === 'function');
}
function updateWriteMode(){
  const el=document.getElementById('excel-write-mode');
  if(!el) return;
  if(canWriteHandle(state.fileHandle)){
    el.textContent='✎ EN ARCHIVO';
    el.className='file-write-mode ok';
  } else {
    el.textContent='⚠ SOLO LECTURA';
    el.className='file-write-mode warn';
  }
}
async function ensureWriteAccess(h){
  if(!canWriteHandle(h)) return false;
  try{
    const opts={mode:'readwrite'};
    if(typeof h.queryPermission==='function'){
      const q=await h.queryPermission(opts);
      if(q==='granted') return true;
    }
    if(typeof h.requestPermission==='function'){
      return (await h.requestPermission(opts))==='granted';
    }
    return true;
  }catch(_){ return false; }
}
async function pickFile() {
  if (window.showOpenFilePicker) {
    try {
      const [h]=await window.showOpenFilePicker(EXCEL_PICKER_OPTS);
      await ensureWriteAccess(h);
      return h;
    } catch(e){
      if(e.name==='AbortError') return null;
      // file:// o Safari: el picker no está permitido → selector clásico
    }
  }
  return pickFileClassic();
}
async function handleFromDrop(dt){
  const item=[...dt.items].find(i=>i.kind==='file');
  if(item && typeof item.getAsFileSystemHandle==='function'){
    try{
      const h=await item.getAsFileSystemHandle();
      if(h && h.kind==='file'){
        await ensureWriteAccess(h);
        return h;
      }
    }catch(_){}
  }
  const f=dt.files && dt.files[0];
  if(!f) return null;
  return {_file:f,name:f.name,getFile:async()=>f,createWritable:null};
}
async function readFileHandle(h){
  const f=await h.getFile();
  return new Promise((res,rej)=>{ const fr=new FileReader();
    fr.onload=e=>res(e.target.result); fr.onerror=rej; fr.readAsArrayBuffer(f); });
}
function pickFileClassic(){
  return new Promise(res=>{
    const i=document.createElement('input'); i.type='file'; i.accept='.xlsx,.xls';
    i.onchange=()=>{ const f=i.files[0]; if(!f) return res(null);
      res({_file:f,name:f.name,getFile:async()=>f,createWritable:null}); };
    i.click();
  });
}
async function saveWorkbook(){
  if(!state.fileHandle) throw new Error('No hay archivo Excel activo.');
  const writable=await ensureWriteAccess(state.fileHandle);
  if(writable && typeof state.fileHandle.createWritable==='function'){
    const arr=XLSX.write(state.workbook,{bookType:'xlsx',type:'array'});
    const w=await state.fileHandle.createWritable();
    await w.write(new Blob([arr],{type:'application/octet-stream'})); await w.close();
    return;
  }
  const arr=XLSX.write(state.workbook,{bookType:'xlsx',type:'array'});
  const url=URL.createObjectURL(new Blob([arr],{type:'application/octet-stream'}));
  const a=document.createElement('a'); a.href=url; a.download=state.fileName; a.click();
  URL.revokeObjectURL(url);
  toast('⚠️ Excel descargado — reemplaza el original (Safari / doble clic no pueden editar el archivo).','info',6000);
}

// ─────────────────────────────────────────────
// WORKBOOK HELPERS
// ─────────────────────────────────────────────
function ensureSheet(wb){
  if(!wb.SheetNames.includes(state.sheetName))
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([HEADERS]),state.sheetName);
}
function ensureInvSheets(wb){
  [[INV_SHEET,INV_HEADERS],[REC_SHEET,REC_HEADERS],[MOV_SHEET,MOV_HEADERS]].forEach(([name,headers])=>{
    if(!wb.SheetNames.includes(name))
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),name);
  });
}
function ensureMenuSheets(wb){
  [[MENU_SHEET,MENU_HEADERS],[CAT_SHEET,CAT_HEADERS],[COST_SHEET,COST_HEADERS],[CATALOG_SHEET,CATALOG_HEADERS],[PRICE_SHEET,PRICE_HEADERS]].forEach(([name,headers])=>{
    if(!wb.SheetNames.includes(name))
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),name);
  });
}
function rowsToSheet(headers, rows){
  return XLSX.utils.aoa_to_sheet([headers, ...rows.map(r=>headers.map(h=>r[h]??''))]);
}
function parseNamedSheet(wb, name, headers){
  const ws=wb.Sheets[name]; if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws,{defval:''})
    .map(row=>{ const o={}; headers.forEach(h=>o[h]=row[h]??''); return o; })
    .filter(r=>String(r[headers[0]]??'').trim());
}
function writeInvSheets(){
  if(!state.workbook) return;
  ensureInvSheets(state.workbook);
  state.workbook.Sheets[INV_SHEET]=rowsToSheet(INV_HEADERS, state.inventory);
  state.workbook.Sheets[REC_SHEET]=rowsToSheet(REC_HEADERS, state.recipes);
  state.workbook.Sheets[MOV_SHEET]=rowsToSheet(MOV_HEADERS, state.movements);
}
function menuCatsInOrder(){
  return [...new Set([...Object.keys(CAT_LABELS), ...MENU.map(i=>i.cat)])];
}
function orderedMenuItems(cat){
  const catItems=MENU.filter(i=>i.cat===cat);
  const orderArr=state.menuOrder[cat]||[];
  return [
    ...orderArr.map(id=>catItems.find(i=>i.id===id)).filter(Boolean),
    ...catItems.filter(i=>!orderArr.includes(i.id)),
  ];
}
function writeMenuCatalogSheets(){
  if(!state.workbook) return;
  ensureMenuSheets(state.workbook);
  const menuRows=[];
  menuCatsInOrder().forEach(cat=>{
    orderedMenuItems(cat).forEach((item,idx)=>{
      menuRows.push({ Id:item.id, Categoria:item.cat, Emoji:item.emoji, Nombre:item.name, Precio:item.price, Orden:idx });
    });
  });
  const catRows=Object.entries(CAT_LABELS).map(([Id,Etiqueta])=>({Id,Etiqueta}));
  const cat=loadCatalog();
  const costRows=Object.entries(cat.costs||{}).filter(([,c])=>c!=null&&c!=='').map(([Producto,Costo])=>({Producto,Costo}));
  const catalogRows=Object.entries(cat.items||{}).map(([Producto,it])=>({
    Producto, Emoji:it.emoji||'🍽️', Categoria:it.cat||'', EnMenu:it.inMenu?'si':'no'
  }));
  const priceRows=[];
  Object.entries(cat.items||{}).forEach(([Producto,it])=>{
    (it.priceHistory||[]).forEach(h=>priceRows.push({ Producto, Desde:h.from||'2000-01-01', Precio:h.price }));
  });
  state.workbook.Sheets[MENU_SHEET]=rowsToSheet(MENU_HEADERS, menuRows);
  state.workbook.Sheets[CAT_SHEET]=rowsToSheet(CAT_HEADERS, catRows);
  state.workbook.Sheets[COST_SHEET]=rowsToSheet(COST_HEADERS, costRows);
  state.workbook.Sheets[CATALOG_SHEET]=rowsToSheet(CATALOG_HEADERS, catalogRows);
  state.workbook.Sheets[PRICE_SHEET]=rowsToSheet(PRICE_HEADERS, priceRows);
}
function applyMenuFromExcelRows(menuRows, catRows){
  if(catRows.length){
    const keep=new Set(catRows.map(r=>String(r.Id||'').trim()).filter(Boolean));
    Object.keys(CAT_LABELS).forEach(k=>{ if(!keep.has(k)) delete CAT_LABELS[k]; });
    catRows.forEach(r=>{
      const id=String(r.Id||'').trim(); if(!id) return;
      CAT_LABELS[id]=String(r.Etiqueta||id).trim()||id;
    });
  }
  const sorted=[...menuRows].sort((a,b)=>{
    const ca=String(a.Categoria||'');
    const cb=String(b.Categoria||'');
    if(ca!==cb) return ca.localeCompare(cb);
    return (parseInt(a.Orden)||0)-(parseInt(b.Orden)||0);
  });
  MENU.length=0;
  state.menuOrder={};
  sorted.forEach(r=>{
    const name=String(r.Nombre||'').trim(); if(!name) return;
    const id=String(r.Id||'').trim()||uid();
    const cat=String(r.Categoria||'smash').trim()||'smash';
    MENU.push({ id, cat, emoji:String(r.Emoji||'🍽️').trim()||'🍽️', name, price:Number(r.Precio)||0 });
    if(!state.menuOrder[cat]) state.menuOrder[cat]=[];
    state.menuOrder[cat].push(id);
  });
  saveMenuOrder();
  saveMenuToStorage();
}
function applyCatalogFromExcelRows(costRows, itemRows, histRows){
  const costs={};
  costRows.forEach(r=>{
    const n=String(r.Producto||'').trim(); if(!n) return;
    const c=parseFloat(r.Costo);
    if(isFinite(c)&&c>0) costs[n]=c;
  });
  const items={};
  itemRows.forEach(r=>{
    const n=String(r.Producto||'').trim(); if(!n) return;
    const flag=String(r.EnMenu||'si').trim().toLowerCase();
    items[n]={
      emoji:String(r.Emoji||'🍽️').trim()||'🍽️',
      cat:String(r.Categoria||'').trim(),
      inMenu:!(flag==='no'||flag==='0'||flag==='false'),
      priceHistory:[],
    };
  });
  histRows.forEach(r=>{
    const n=String(r.Producto||'').trim(); if(!n) return;
    if(!items[n]) items[n]={ emoji:'🍽️', cat:'', inMenu:false, priceHistory:[] };
    items[n].priceHistory.push({ from:String(r.Desde||'2000-01-01'), price:Number(r.Precio)||0 });
  });
  catalogCache={ costs, items };
  saveCatalog(catalogCache);
}
function hydrateMenuCatalogFromWorkbook(wb){
  ensureMenuSheets(wb);
  const menuRows=parseNamedSheet(wb, MENU_SHEET, MENU_HEADERS);
  const catRows=parseNamedSheet(wb, CAT_SHEET, CAT_HEADERS);
  const costRows=parseNamedSheet(wb, COST_SHEET, COST_HEADERS);
  const itemRows=parseNamedSheet(wb, CATALOG_SHEET, CATALOG_HEADERS);
  const histRows=parseNamedSheet(wb, PRICE_SHEET, PRICE_HEADERS);
  let needSave=false;
  if(menuRows.length) applyMenuFromExcelRows(menuRows, catRows);
  else needSave=true;
  if(costRows.length||itemRows.length||histRows.length) applyCatalogFromExcelRows(costRows, itemRows, histRows);
  else needSave=true;
  return needSave;
}
async function persistMenuCatalog(immediate){
  saveMenuToStorage();
  saveMenuOrder();
  if(catalogCache) saveCatalog(catalogCache);
  if(!state.workbook || state._hydrating) return;
  writeMenuCatalogSheets();
  const run=()=>persistWorkbook().catch(e=>toast('Error al guardar menú/costos: '+e.message,'error'));
  if(immediate){ clearTimeout(persistMenuTimer); await run(); return; }
  clearTimeout(persistMenuTimer);
  persistMenuTimer=setTimeout(run, 500);
}
function parseOrders(wb){
  const ws=wb.Sheets[state.sheetName]; if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws,{defval:''}).map(o=>{
    const ymd=toYmd(o['Fecha']); if(ymd) o['Fecha']=ymd;
    const hms=toHms(o['Hora']); if(hms) o['Hora']=hms;
    return o;
  });
}
function getNextOrderNum(orders){
  if(!orders.length) return 1;
  return Math.max(...orders.map(o=>parseInt(o['Num_Orden'])||0))+1;
}
async function persistWorkbook(){
  const rows=[HEADERS,...state.allOrders.map(o=>HEADERS.map(h=>o[h]??''))];
  state.workbook.Sheets[state.sheetName]=XLSX.utils.aoa_to_sheet(rows);
  writeInvSheets();
  writeMenuCatalogSheets();
  await saveWorkbook();
}

// ─────────────────────────────────────────────
// LOAD EXCEL
// ─────────────────────────────────────────────
async function loadExcel(handle){
  const ab=await readFileHandle(handle);
  const wb=XLSX.read(ab,{type:'array',cellDates:true});
  ensureSheet(wb);
  ensureInvSheets(wb);
  ensureMenuSheets(wb);
  state.workbook=wb; state.fileHandle=handle;
  state.fileName=handle.name||handle._file?.name||'archivo.xlsx';
  state.allOrders=parseOrders(wb);
  state.inventory=parseNamedSheet(wb, INV_SHEET, INV_HEADERS);
  state.recipes=parseNamedSheet(wb, REC_SHEET, REC_HEADERS);
  state.movements=parseNamedSheet(wb, MOV_SHEET, MOV_HEADERS);
  state._hydrating=true;
  const migrated=hydrateMenuCatalogFromWorkbook(wb);
  state._hydrating=false;
  if(migrated){
    writeMenuCatalogSheets();
    try{
      await saveWorkbook();
      toast('✔ Menú y costos del navegador se copiaron al Excel. Si Safari descargó copia, reemplaza el original.','success',7000);
    }catch(e){ toast('Menú listo en memoria, pero no se pudo escribir el Excel: '+e.message,'error',6000); }
  }
  renderMenuGrid(); renderMenuEditor(); refreshCategoryLabels();
  document.getElementById('active-filename').textContent=state.fileName;
  document.getElementById('modal-current-file').textContent=state.fileName;
  updateWriteMode();
}

// ─────────────────────────────────────────────
// SETUP SCREEN
// ─────────────────────────────────────────────
function setupScreen(){
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
}
async function createNewExcel(){
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([HEADERS]),state.sheetName);
  ensureInvSheets(wb);
  ensureMenuSheets(wb);
  const prevWb=state.workbook;
  state.workbook=wb;
  writeMenuCatalogSheets();
  state.workbook=prevWb;
  const arr=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  if(window.showSaveFilePicker){
    try{
      const h=await window.showSaveFilePicker({
        id: 'smashiza-ordenes',
        suggestedName:'LaSmashiza_Ordenes.xlsx',
        types: EXCEL_PICKER_OPTS.types,
      });
      const ok=await ensureWriteAccess(h);
      const w=await h.createWritable();
      await w.write(new Blob([arr],{type:'application/octet-stream'})); await w.close();
      if(!ok) toast('Archivo creado, pero sin permiso de edición. Vuelve a elegirlo.','info',6000);
      await loadExcel(h);
      goToApp();
      toast('✔ Excel creado. Guárdalo en OneDrive si aún no está ahí.','success',5000);
      return;
    }catch(e){ if(e.name==='AbortError') return; }
  }
  const url=URL.createObjectURL(new Blob([arr],{type:'application/octet-stream'}));
  const a=document.createElement('a'); a.href=url; a.download='LaSmashiza_Ordenes.xlsx'; a.click();
  URL.revokeObjectURL(url); toast('📥 Excel descargado. Selecciónalo arriba.','info',5000);
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
function goToApp(){
  document.getElementById('screen-setup').classList.replace('active','hidden');
  document.getElementById('screen-app').classList.replace('hidden','active');
  // Pre-select today in dashboard
  state.dashSelectedDates = new Set([today()]);
  refreshDashboard(); renderOrdersTable(); updateOrderNumBadge();
  renderInventory(); renderMenuGrid(); renderMenuEditor(); refreshCategoryLabels();
}
function initNav(){
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
        const f=document.getElementById('f-fecha');
        if(f && !f.value) stampNewOrderWhen();
      }
      if(btn.dataset.tab==='tab-ordenes')   renderOrdersTable();
      if(btn.dataset.tab==='tab-menu')      renderMenuEditor();
      if(btn.dataset.tab==='tab-clientes')  renderClientsTab();
      if(btn.dataset.tab==='tab-analisis'){ renderCostEditor(); renderBA(); }
      if(btn.dataset.tab==='tab-inventario') renderInventory();
    });
  });
}

// ─────────────────────────────────────────────
// CHANGE EXCEL
// ─────────────────────────────────────────────
function initChangeExcel(){
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

// ─────────────────────────────────────────────
// CLIENTE AUTOCOMPLETE
// ─────────────────────────────────────────────
function foldTxt(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
}
function getKnownClients(){
  const seen=new Map();
  for(let i=state.allOrders.length-1;i>=0;i--){
    const o=state.allOrders[i];
    const k=(o['Cliente']||'').trim();
    if(!k||k.toLowerCase()==='sin nombre') continue;
    if(!seen.has(k)) seen.set(k,{cliente:k,direccion:(o['Direccion']||'').trim()});
  }
  return [...seen.values()];
}
function renderClienteSuggestions(){
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
  const matches=getKnownClients().filter(c=>foldTxt(c.cliente).includes(q)).slice(0,8);
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
function initClienteAutocomplete(){
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

// ─────────────────────────────────────────────
// MENU GRID (picker en Nueva Orden)
// ─────────────────────────────────────────────
function getFilteredMenuItems(){
  let items = state.activeCat==='all' ? MENU : MENU.filter(i=>i.cat===state.activeCat);
  const q = state.menuSearch.trim().toLowerCase();
  if(q) items=items.filter(i=>i.name.toLowerCase().includes(q)||i.cat.toLowerCase().includes(q));
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
function renderMenuGrid(){
  const grid=document.getElementById('menu-grid');
  const items=getFilteredMenuItems();
  if(!items.length){ grid.innerHTML='<div class="empty-list">Sin resultados</div>'; return; }
  grid.innerHTML=items.map(item=>`
    <button class="menu-item-btn ${state.cart.find(c=>c.item.id===item.id)?'active-item':''}" data-id="${item.id}">
      <span class="menu-item-emoji">${item.emoji}</span>
      <span class="menu-item-name">${escHtml(item.name)}</span>
      <span class="menu-item-price">${fmtMoney(item.price)}</span>
    </button>`).join('');
  grid.querySelectorAll('.menu-item-btn').forEach(btn=>btn.addEventListener('click',()=>addToCart(btn.dataset.id)));
}
function initMenuSearch(){
  const inp=document.getElementById('menu-search');
  if(!inp) return;
  inp.addEventListener('input',()=>{ state.menuSearch=inp.value; renderMenuGrid(); });
}
function renderCategoryBtns(){
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
function initCategoryBtns(){ renderCategoryBtns(); }

// ─────────────────────────────────────────────
// CART + AJUSTE
// ─────────────────────────────────────────────
function addToCart(itemId){
  const item=MENU.find(i=>i.id===itemId); if(!item) return;
  const existing=state.cart.find(c=>c.item.id===itemId);
  if(existing) existing.qty++; else state.cart.push({item,qty:1});
  renderCart(); renderMenuGrid();
}
function removeFromCart(itemId){
  state.cart=state.cart.filter(c=>c.item.id!==itemId);
  renderCart(); renderMenuGrid();
}
function changeQty(itemId,delta){
  const e=state.cart.find(c=>c.item.id===itemId); if(!e) return;
  e.qty+=delta;
  if(e.qty<=0) removeFromCart(itemId); else { renderCart(); renderMenuGrid(); }
}
function cartSubtotal(){ return state.cart.reduce((s,c)=>s+c.item.price*c.qty,0); }
function cartTotal()   { return peso(Math.max(0,cartSubtotal()+state.ajuste)); }

function renderCashResult(el, total, recibidoOpt){
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
function updateCashUI(){
  const wrap=document.getElementById('cash-wrap');
  if(!wrap) return;
  const isCash=state.payMethod==='Efectivo';
  wrap.classList.toggle('hidden', !isCash);
  if(!isCash) return;
  renderCashResult(document.getElementById('cash-result'), cartTotal(), parsePesoOptional(document.getElementById('f-recibido')?.value));
}
function updateEditCashUI(){
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
function applyCashQuick(inputId, amount){
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

function renderCart(){
  const el=document.getElementById('ticket-items');
  const subEl=document.getElementById('ticket-subtotal');
  const ajEl=document.getElementById('ticket-ajuste-display');
  const totEl=document.getElementById('ticket-total');
  if(!state.cart.length){
    el.innerHTML='<div class="empty-ticket">Sin productos</div>';
    subEl&&(subEl.textContent='$0.00'); totEl.textContent='$0.00';
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
function initAjuste(){
  const inp=document.getElementById('f-ajuste'); if(!inp) return;
  inp.addEventListener('input',()=>{ state.ajuste=parseFloat(inp.value)||0; renderCart(); });
}

// ─────────────────────────────────────────────
// PAY TOGGLE
// ─────────────────────────────────────────────
function initPayToggle(){
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
function updateOrderNumBadge(){
  document.getElementById('orden-num-badge').textContent=`#${String(getNextOrderNum(state.allOrders)).padStart(4,'0')}`;
}

// ─────────────────────────────────────────────
// SAVE ORDER
// ─────────────────────────────────────────────
async function saveOrder(){
  if(!state.workbook){ toast('⚠️ No hay Excel cargado.','error'); return; }
  if(!state.cart.length){ toast('⚠️ Agrega al menos un producto.','error'); return; }
  const now=new Date();
  const numOrden=getNextOrderNum(state.allOrders);
  const newRow={
    Num_Orden:numOrden,
    Fecha:toYmd(document.getElementById('f-fecha')?.value)||fmtDate(now),
    Hora:toHms(document.getElementById('f-hora')?.value)||fmtTime(now),
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
    if(cash.empty) toast('Sin monto recibido — se guardó sin cambio','info');
    else { newRow.Recibido=cash.recibido; newRow.Cambio=cash.cambio; }
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
function clearForm(){
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

// ─────────────────────────────────────────────
// RELOAD
// ─────────────────────────────────────────────
async function reloadExcel(){
  if(!state.fileHandle){ toast('No hay Excel cargado.','error'); return; }
  try{ await loadExcel(state.fileHandle); toast('✔ Excel recargado','success'); refreshDashboard(); renderOrdersTable(); renderInventory(); }
  catch(e){ toast('Error: '+e.message,'error'); }
}

// ─────────────────────────────────────────────
// UPDATE ORDER STATUS
// ─────────────────────────────────────────────
async function updateOrderStatus(numOrden,newEstado){
  const o=state.allOrders.find(o=>String(o['Num_Orden'])===String(numOrden));
  if(!o) return;
  const prev=snapshotOrderInv(o);
  o['Estado']=newEstado;
  const invRes=syncOrderInventory(o,{prev});
  try{ await persistWorkbook(); toast(`✔ #${String(numOrden).padStart(4,'0')} → ${newEstado}`,'success');
    notifyInventoryResult(invRes);
    refreshDashboard(); renderOrdersTable(); renderInventory();
  }catch(e){ toast('Error: '+e.message,'error'); }
}

// ─────────────────────────────────────────────
// ORDER DETAIL MODAL — with product picker + delete
// ─────────────────────────────────────────────
function buildEditCartHtml(editCart){
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

function openOrderDetail(numOrden){
  const order=state.allOrders.find(o=>String(o['Num_Orden'])===String(numOrden));
  if(!order) return;
  const slug=s=>(s||'').toLowerCase().replace(/\s+/g,'-');

  // Parse existing products into editCart
  const productos=String(order['Productos']||'').split(' | ').filter(Boolean);
  const cantidades=String(order['Cantidades']||'').split(' | ');
  const editCart=productos.map((p,i)=>{
    const menuItem=MENU.find(m=>m.name===p);
    return {
      name:p,
      emoji:menuItem?menuItem.emoji:'🍽️',
      price:menuItem?menuItem.price:0,
      qty:parseInt(cantidades[i])||1,
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

function refreshEditCart(){
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

function renderModalMenuPicker(){
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
      if(ex) ex.qty++; else editCart.push({name:item.name,emoji:item.emoji,price:item.price,qty:1});
      refreshEditCart();
    });
  });
}

function initOrderDetailModal(){
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
    const hora=toHms(document.getElementById('edit-hora')?.value);
    if(!fecha){ toast('Pon una fecha válida','error'); return; }
    order['Fecha']=fecha;
    order['Hora']=hora||order['Hora']||fmtTime();
    order['Estado']     =document.getElementById('detail-estado-select').value;
    order['Productos']  =editCart.map(c=>c.name).join(' | ');
    order['Cantidades'] =editCart.map(c=>`${c.qty}x`).join(' | ');

    try{
      const invRes=syncOrderInventory(order,{prev});
      await persistWorkbook();
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
      await persistWorkbook();
      toast(`🗑️ Orden #${String(numOrden).padStart(4,'0')} eliminada`,'info');
      modal.classList.add('hidden'); refreshDashboard(); renderOrdersTable(); renderInventory();
    }catch(e){ toast('Error: '+e.message,'error'); }
  });
}

// ─────────────────────────────────────────────
// ORDERS TABLE
// ─────────────────────────────────────────────
function badgeClass(e){ return `badge badge-${(e||'').toLowerCase().replace(/\s+/g,'-')}`; }

function renderOrdersStats(){
  const todayStr=today();
  const todayO=state.allOrders.filter(o=>String(o['Fecha']).startsWith(todayStr));
  const ventas=todayO.reduce((s,o)=>s+(parseFloat(o['Total'])||0),0);
  document.getElementById('qs-ordenes').textContent  =todayO.length;
  document.getElementById('qs-ventas').textContent   =fmtMoney(ventas);
  const qsCaja=document.getElementById('qs-caja');
  if(qsCaja) qsCaja.textContent=fmtMoney(todayCashInDrawer());
  document.getElementById('qs-pend').textContent     =todayO.filter(o=>o['Estado']==='Pendiente').length;
  document.getElementById('qs-prep').textContent     =todayO.filter(o=>o['Estado']==='Preparando').length;
  document.getElementById('qs-entregadas').textContent=todayO.filter(o=>o['Estado']==='Entregada').length;
}

function renderOrdersTable(){
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

function initOrdersFilter(){
  document.getElementById('filter-fecha').value=today();
  ['filter-fecha','filter-estado','filter-buscar'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.addEventListener('input',renderOrdersTable); el.addEventListener('change',renderOrdersTable); }
  });
  document.getElementById('btn-reload').addEventListener('click',reloadExcel);
  document.getElementById('btn-clear-date').addEventListener('click',()=>{
    document.getElementById('filter-fecha').value=''; renderOrdersTable();
  });
}

// ─────────────────────────────────────────────
// DASHBOARD — Date Range Picker + bar chart
// ─────────────────────────────────────────────

// Range state: {start:'YYYY-MM-DD', end:'YYYY-MM-DD'} or null = all history
const dashRange = { start: null, end: null, hovering: null, picking: false };

function initDashboardFilter(){
  dashRange.start = today();
  dashRange.end   = today();

  // Calendar collapsed by default
  const calWrap = document.getElementById('cal-collapse');
  const toggleBtn = document.getElementById('btn-dash-toggle-cal');
  let calOpen = false;
  function setCalOpen(open){
    calOpen = open;
    calWrap.classList.toggle('hidden', !open);
    toggleBtn.textContent = open ? '📅 OCULTAR CALENDARIO ▲' : '📅 SELECCIONAR FECHAS ▼';
  }
  setCalOpen(false);
  toggleBtn.addEventListener('click', ()=> setCalOpen(!calOpen));

  document.getElementById('btn-dash-hoy').addEventListener('click',()=>{
    dashRange.start=today(); dashRange.end=today(); dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });
  document.getElementById('btn-dash-semana').addEventListener('click',()=>{
    const d=new Date(); d.setDate(d.getDate()-6);
    dashRange.start=fmtDate(d); dashRange.end=today(); dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });
  document.getElementById('btn-dash-mes').addEventListener('click',()=>{
    const d=new Date(); d.setDate(1);
    dashRange.start=fmtDate(d); dashRange.end=today(); dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });
  document.getElementById('btn-dash-todo').addEventListener('click',()=>{
    dashRange.start=null; dashRange.end=null; dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });

  const now=new Date();
  dashRange._viewYear  = now.getFullYear();
  dashRange._viewMonth = now.getMonth();

  document.getElementById('btn-cal-prev').addEventListener('click',()=>{
    dashRange._viewMonth--;
    if(dashRange._viewMonth<0){ dashRange._viewMonth=11; dashRange._viewYear--; }
    rebuildMonthsHtml();
  });
  document.getElementById('btn-cal-next').addEventListener('click',()=>{
    dashRange._viewMonth++;
    if(dashRange._viewMonth>11){ dashRange._viewMonth=0; dashRange._viewYear++; }
    rebuildMonthsHtml();
  });

  renderRangePicker();
}

function renderRangePicker(){
  const label=document.getElementById('dash-range-label');
  if(label){
    if(!dashRange.start) label.textContent='Todo el historial';
    else if(!dashRange.end||dashRange.start===dashRange.end) label.textContent=dashRange.start;
    else label.textContent=`${dashRange.start} → ${dashRange.end}`;
  }

  const yr=dashRange._viewYear||new Date().getFullYear();
  const mo=dashRange._viewMonth||0;
  const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;

  const calLeft=document.getElementById('cal-left');
  const calRight=document.getElementById('cal-right');
  if(!calLeft||!calRight) return;

  calLeft.innerHTML  = buildMonth(yr, mo);
  calRight.innerHTML = buildMonth(yr2, mo2);

  // Use event delegation on cal-months container — avoids destroying
  // listeners by re-binding on a stable parent instead of each .cal-day
  const calMonths=document.getElementById('cal-months-wrap');
  if(!calMonths) return;

  // Remove old delegated listeners by cloning the node
  const fresh=calMonths.cloneNode(true);
  calMonths.replaceWith(fresh);
  // Re-populate children (cloneNode copies innerHTML too, so grids are intact)

  fresh.addEventListener('click', e=>{
    const el=e.target.closest('.cal-day[data-date]');
    if(!el) return;
    const d=el.dataset.date;
    if(!dashRange.picking){
      dashRange.start=d; dashRange.end=null;
      dashRange.picking=true; dashRange.hovering=null;
    } else {
      if(d<dashRange.start){ dashRange.end=dashRange.start; dashRange.start=d; }
      else dashRange.end=d;
      dashRange.picking=false; dashRange.hovering=null;
      refreshDashboard();
      document.getElementById('cal-collapse')?.classList.add('hidden');
      const tb=document.getElementById('btn-dash-toggle-cal');
      if(tb) tb.textContent='📅 SELECCIONAR FECHAS ▼';
    }
    // Only rebuild the month HTML, not the container
    rebuildMonthsHtml();
  });

  fresh.addEventListener('mouseover', e=>{
    if(!dashRange.picking) return;
    const el=e.target.closest('.cal-day[data-date]');
    if(!el) return;
    if(dashRange.hovering===el.dataset.date) return; // no change
    dashRange.hovering=el.dataset.date;
    rebuildMonthsHtml();
  });

  fresh.addEventListener('mouseleave', ()=>{
    if(!dashRange.picking||!dashRange.hovering) return;
    dashRange.hovering=null;
    rebuildMonthsHtml();
  });
}

// Only rebuild the inner month HTML without touching the event delegation container
function rebuildMonthsHtml(){
  const yr=dashRange._viewYear||new Date().getFullYear();
  const mo=dashRange._viewMonth||0;
  const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;
  const calLeft=document.getElementById('cal-left');
  const calRight=document.getElementById('cal-right');
  const label=document.getElementById('dash-range-label');
  if(calLeft)  calLeft.innerHTML  = buildMonth(yr, mo);
  if(calRight) calRight.innerHTML = buildMonth(yr2, mo2);
  if(label){
    if(!dashRange.start) label.textContent='Todo el historial';
    else if(!dashRange.end||dashRange.start===dashRange.end) label.textContent=dashRange.start;
    else label.textContent=`${dashRange.start} → ${dashRange.end}`;
  }
}

function buildMonth(year, month){
  const MONTH_NAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAY_NAMES=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

  // Get all dates that have orders for dot indicator
  const datesWithOrders=new Set(state.allOrders.map(o=>String(o['Fecha'])));

  const firstDay=new Date(year,month,1).getDay(); // 0=Sun
  const daysInMonth=new Date(year,month+1,0).getDate();

  const hover=dashRange.hovering;
  const rangeEnd=dashRange.picking&&hover ? (hover>dashRange.start?hover:dashRange.start) : dashRange.end;
  const rangeStart=dashRange.picking&&hover&&hover<dashRange.start ? hover : dashRange.start;

  let html=`
    <div class="cal-month-title">${MONTH_NAMES[month]} ${year}</div>
    <div class="cal-grid">
      ${DAY_NAMES.map(d=>`<div class="cal-header-day">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div class="cal-day cal-empty"></div>').join('')}`;

  for(let day=1;day<=daysInMonth;day++){
    const dateStr=`${year}-${pad(month+1)}-${pad(day)}`;
    const isStart=dateStr===dashRange.start;
    const isEnd=dateStr===dashRange.end||(dashRange.picking&&dateStr===hover);
    const inRange=rangeStart&&rangeEnd&&dateStr>rangeStart&&dateStr<rangeEnd;
    const isToday=dateStr===today();
    const hasOrders=datesWithOrders.has(dateStr);

    let cls='cal-day';
    if(isStart) cls+=' cal-start';
    else if(isEnd) cls+=' cal-end';
    else if(inRange) cls+=' cal-in-range';
    if(isToday) cls+=' cal-today';

    html+=`<div class="${cls}" data-date="${dateStr}">
      ${day}${hasOrders?'<span class="cal-dot"></span>':''}
    </div>`;
  }
  html+='</div>';
  return html;
}

function getDashOrders(){
  // No range selected = all history
  if(!dashRange.start) return state.allOrders;
  const s = dashRange.start;
  // If picking (second click not done yet) or end is null, treat as single day
  const e = dashRange.end || dashRange.start;
  return state.allOrders.filter(o=>{
    const f = String(o['Fecha']||'');
    return f >= s && f <= e;
  });
}

function renderDateChips(){} // kept for compat, no-op

function refreshDashboard(){
  const periodoO  = getDashOrders();
  const activasO  = periodoO.filter(o=>o['Estado']!=='Cancelada');
  const canceladas= periodoO.filter(o=>o['Estado']==='Cancelada').length;
  const totalOrders=activasO.length;
  const totalVentas=activasO.reduce((s,o)=>s+(parseFloat(o['Total'])||0),0);
  const avgTicket  =totalOrders?totalVentas/totalOrders:0;

  const ticketLabel=document.getElementById('stat-ticket-label');
  if(ticketLabel){
    if(!dashRange.start) ticketLabel.textContent='TICKET PROM. HISTÓRICO';
    else if(dashRange.start===dashRange.end||!dashRange.end) ticketLabel.textContent='TICKET PROM. DÍA';
    else ticketLabel.textContent='TICKET PROM. PERÍODO';
  }

  document.getElementById('stat-ordenes').textContent    =totalOrders;
  document.getElementById('stat-ventas').textContent     =fmtMoney(totalVentas);
  document.getElementById('stat-ticket').textContent     =fmtMoney(avgTicket);
  document.getElementById('stat-canceladas').textContent =canceladas;
  const statCaja=document.getElementById('stat-caja');
  if(statCaja) statCaja.textContent=fmtMoney(todayCashInDrawer());

  document.getElementById('bar-ordenes').style.width    ='60%';
  document.getElementById('bar-ventas').style.width     ='80%';
  document.getElementById('bar-ticket').style.width     ='50%';
  document.getElementById('bar-canceladas').style.width =periodoO.length?`${(canceladas/periodoO.length)*100}%`:'0%';
  const barCaja=document.getElementById('bar-caja');
  if(barCaja) barCaja.style.width='70%';

  // Top burgers
  const cnt={};
  activasO.forEach(o=>{
    if(!o['Productos']) return;
    o['Productos'].split(' | ').forEach((name,i)=>{
      const q=parseInt((o['Cantidades']||'').split(' | ')[i])||1;
      cnt[name]=(cnt[name]||0)+q;
    });
  });
  const sorted=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const topEl=document.getElementById('top-burgers');
  if(!sorted.length){ topEl.innerHTML='<li class="empty-list">Sin ventas en este período</li>'; }
  else {
    const medals=['🥇','🥈','🥉','4','5','6'];
    topEl.innerHTML=sorted.map(([name,qty],i)=>`
      <li><span class="top-rank">${medals[i]}</span><span class="top-name">${escHtml(name)}</span><span class="top-qty">${qty}</span></li>`).join('');
  }

  // Payment bars
  const pays={Efectivo:0,Transferencia:0,Tarjeta:0};
  activasO.forEach(o=>{ if(pays[o['Metodo_Pago']]!==undefined) pays[o['Metodo_Pago']]++; });
  const totalPays=Object.values(pays).reduce((a,b)=>a+b,0)||1;
  ['efectivo','transferencia','tarjeta'].forEach(k=>{
    const key=k.charAt(0).toUpperCase()+k.slice(1);
    const pct=Math.round((pays[key]/totalPays)*100);
    document.getElementById(`bar-${k}`).style.width=`${pct}%`;
    document.getElementById(`pct-${k}`).textContent=`${pct}%`;
  });

  // Recent (always today)
  const todayStr=today();
  const todayO=state.allOrders.filter(o=>String(o['Fecha']).startsWith(todayStr));
  const recentEl=document.getElementById('recent-orders');
  const recent=[...todayO].reverse().slice(0,12);
  if(!recent.length){ recentEl.innerHTML='<div class="empty-list">Sin órdenes hoy</div>'; }
  else {
    recentEl.innerHTML=recent.map(o=>{
      const rt=relTime(o['Fecha'],o['Hora']);
      const com=o['Comentarios']?`<span class="recent-comment">💬 ${escHtml(o['Comentarios'])}</span>`:'';
      return `<div class="recent-row" data-orden="${o['Num_Orden']}" style="cursor:pointer">
        <span class="recent-num">#${String(o['Num_Orden']||'').padStart(4,'0')}</span>
        <div class="recent-info"><span class="recent-client">${escHtml(o['Cliente']||'Sin nombre')}</span>${com}</div>
        <span class="rel-time ${rt.cls}" data-fecha="${o['Fecha']}" data-hora="${o['Hora']}">${rt.label}</span>
        <span class="recent-total">${fmtMoney(o['Total']||0)}</span>
        <span class="${badgeClass(o['Estado'])}">${o['Estado']||''}</span>
      </div>`;
    }).join('');
    recentEl.querySelectorAll('.recent-row').forEach(row=>row.addEventListener('click',()=>openOrderDetail(row.dataset.orden)));
  }

  // Bar chart by date
  renderDashChart(activasO);
  renderDashInvAlerts();
  renderLiveQueue();
}

function goToInventarioTab(){
  const btn=document.querySelector('.nav-btn[data-tab="tab-inventario"]');
  if(btn) btn.click();
}
function renderDashInvAlerts(){
  const el=document.getElementById('dash-inv-alert');
  if(!el) return;
  if(!state.inventory.length){
    el.className='card dash-inv-alert dash-inv-ok';
    el.innerHTML=`<div class="dash-inv-head"><h3 class="card-title" style="margin:0"><span class="pixel-icon">📦</span> INVENTARIO</h3>
      <span class="table-hint">Carga ingredientes en la tab Inventario</span></div>`;
    return;
  }
  const red=state.inventory.filter(i=>invLevel(i)==='red');
  const yellow=state.inventory.filter(i=>invLevel(i)==='yellow');
  const buy=restockBuyItems();
  const urgent=red.length+yellow.length;
  if(!urgent && !buy.length){
    el.className='card dash-inv-alert dash-inv-ok';
    el.innerHTML=`<div class="dash-inv-head">
      <h3 class="card-title" style="margin:0"><span class="pixel-icon">📦</span> INVENTARIO OK</h3>
      <button type="button" class="btn-secondary btn-inline" id="btn-dash-goto-inv">VER INVENTARIO</button>
    </div>
    <p class="table-hint" style="margin:0">Nada en mínimo y nada por debajo del ideal.</p>`;
    document.getElementById('btn-dash-goto-inv')?.addEventListener('click',goToInventarioTab);
    return;
  }
  el.className='card dash-inv-alert'+(red.length?' dash-inv-crit':' dash-inv-warn');
  const chip=items=>items.map(i=>`<span class="dash-inv-chip">${escHtml(i['Nombre'])} <strong>${fmtInvQty(i['Stock'])} ${escHtml(i['Unidad']||'')}</strong></span>`).join('');
  const buyChip=buy.slice(0,12).map(r=>`<span class="dash-inv-chip">${escHtml(r.item['Nombre'])} <strong>+${fmtInvQty(r.buy)}</strong></span>`).join('');
  const more=buy.length>12?`<span class="table-hint">+${buy.length-12} más</span>`:'';
  el.innerHTML=`<div class="dash-inv-head">
      <h3 class="card-title" style="margin:0"><span class="pixel-icon">${red.length?'🔴':'🟡'}</span> AVISOS DE INVENTARIO</h3>
      <button type="button" class="btn-secondary btn-inline" id="btn-dash-goto-inv">VER INVENTARIO</button>
    </div>
    <div class="dash-inv-body">
      ${red.length?`<div class="dash-inv-row"><span class="dash-inv-lbl red">SIN STOCK / NEGATIVO</span><div class="dash-inv-chips">${chip(red)}</div></div>`:''}
      ${yellow.length?`<div class="dash-inv-row"><span class="dash-inv-lbl yellow">EN MÍNIMO</span><div class="dash-inv-chips">${chip(yellow)}</div></div>`:''}
      ${buy.length?`<div class="dash-inv-row"><span class="dash-inv-lbl buy">POR COMPRAR (${buy.length})</span><div class="dash-inv-chips">${buyChip}${more}</div></div>`:''}
    </div>`;
  document.getElementById('btn-dash-goto-inv')?.addEventListener('click',goToInventarioTab);
}

function renderDashChart(activasO){
  const chartWrap=document.getElementById('dash-chart');
  if(!chartWrap) return;

  // Accumulate by weekday (0=Sun … 6=Sat), reorder Mon-Sun
  const byWeekday = Array(7).fill(0).map(()=>({total:0, count:0}));
  activasO.forEach(o=>{
    const f = String(o['Fecha']||'');
    if(!f) return;
    const dt = new Date(f+'T12:00:00');
    if(isNaN(dt)) return;
    const wd = dt.getDay(); // 0=Sun
    byWeekday[wd].total += parseFloat(o['Total'])||0;
    byWeekday[wd].count++;
  });

  // Display Mon(1)→Sun(0)
  const ORDER  = [1,2,3,4,5,6,0];
  const LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const COLORS  = ['','','','','#e63232','#e63232','']; // highlight Fri/Sat

  const values = ORDER.map(wd=>byWeekday[wd].total);
  const counts = ORDER.map(wd=>byWeekday[wd].count);
  const maxVal = Math.max(...values)||1;

  if(values.every(v=>v===0)){
    chartWrap.innerHTML='<div class="empty-list">Sin datos para graficar</div>'; return;
  }

  const bars = LABELS.map((label,i)=>{
    const pct  = Math.round((values[i]/maxVal)*100);
    const color= COLORS[i]||'var(--blue-mid)';
    const avg  = counts[i]>0 ? fmtMoney(values[i]/counts[i]) : '—';
    return `<div class="chart-bar-col">
      <div class="chart-bar-label-top">${fmtMoney(values[i])}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar chart-bar-active" style="height:${pct}%;background:${color}"></div>
      </div>
      <div class="chart-bar-day" style="font-size:9px">${label}</div>
      <div class="chart-bar-date" style="color:var(--beige-dark);font-size:9px">${counts[i]} órds · x̄${avg}</div>
    </div>`;
  }).join('');

  chartWrap.innerHTML=`<div class="chart-container">${bars}</div>`;
}

// ─────────────────────────────────────────────
// MENU EDITOR
// ─────────────────────────────────────────────
function saveMenuOrder(){
  localStorage.setItem('smashiza_menu_order',JSON.stringify(state.menuOrder));
}

function renderMenuEditor(){
  const el=document.getElementById('menu-editor-content');
  const catsFromMenu=[...new Set(MENU.map(i=>i.cat))];
  const catsFromLabels=Object.keys(CAT_LABELS);
  const cats=[...new Set([...catsFromLabels,...catsFromMenu])];

  el.innerHTML=`
    <div class="menu-editor-top">
      <button class="btn-primary btn-inline" id="btn-add-product" style="width:auto">➕ NUEVO PRODUCTO</button>
      <button class="btn-primary btn-inline" id="btn-add-category" style="width:auto;background:var(--blue-mid);box-shadow:0 4px 0 var(--blue)">🗂️ NUEVA CATEGORÍA</button>
      <button class="btn-secondary btn-inline" id="btn-reset-menu">↩ RESTAURAR DEFAULTS</button>
    </div>
    ${cats.map(cat=>{
      // Get items in custom order
      const orderArr=state.menuOrder[cat]||[];
      const catItems=MENU.filter(i=>i.cat===cat);
      const ordered=[
        ...orderArr.map(id=>catItems.find(i=>i.id===id)).filter(Boolean),
        ...catItems.filter(i=>!orderArr.includes(i.id)),
      ];
      return `
      <div class="menu-editor-section">
        <div class="menu-editor-cat-header">
          <input class="pixel-input menu-editor-cat cat-rename" data-cat="${cat}" value="${escHtml(getCatLabel(cat))}" title="Renombrar categoría (el ID no cambia)"/>
          <button class="btn-del-cat" data-cat="${cat}" title="Eliminar categoría">🗑️ cat</button>
        </div>
        ${ordered.map((item,idx)=>`
          <div class="menu-editor-row" data-id="${item.id}" data-cat="${cat}">
            <div class="sort-handle" title="Arrastrar para reordenar">⠿</div>
            <button class="sort-btn" data-id="${item.id}" data-cat="${cat}" data-dir="up" title="Subir" ${idx===0?'disabled':''}>▲</button>
            <button class="sort-btn" data-id="${item.id}" data-cat="${cat}" data-dir="down" title="Bajar" ${idx===ordered.length-1?'disabled':''}>▼</button>
            <input class="pixel-input med-emoji" data-id="${item.id}" data-field="emoji" value="${escHtml(item.emoji)}" placeholder="🍔" style="width:50px;text-align:center;font-size:1.2rem"/>
            <input class="pixel-input med-name" data-id="${item.id}" data-field="name" value="${escHtml(item.name)}" placeholder="Nombre" />
            <input class="pixel-input med-price" type="number" data-id="${item.id}" data-field="price" value="${item.price}" placeholder="Precio" min="0" step="1" />
            <select class="pixel-input med-cat" data-id="${item.id}" data-field="cat">
              ${cats.map(c=>`<option value="${c}" ${c===item.cat?'selected':''}>${getCatLabel(c)}</option>`).join('')}
            </select>
            <button class="btn-del-menu" data-id="${item.id}" title="Eliminar producto">🗑️</button>
          </div>`).join('')}
        ${ordered.length===0?'<div class="empty-list" style="padding:.5rem">Categoría vacía</div>':''}
      </div>`;
    }).join('')}`;

  // Rename category label (ID stays the same)
  el.querySelectorAll('.cat-rename').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const id=inp.dataset.cat;
      const label=inp.value.trim();
      if(!label){
        inp.value=getCatLabel(id);
        toast('El nombre de la categoría no puede estar vacío','error');
        return;
      }
      CAT_LABELS[id]=label;
      persistMenuCatalog(true);
      refreshCategoryLabels();
      toast('✔ Categoría: '+label,'success');
    });
  });

  // Sort buttons ▲▼
  el.querySelectorAll('.sort-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat, id=btn.dataset.id, dir=btn.dataset.dir;
      const catItems=MENU.filter(i=>i.cat===cat);
      const orderArr=state.menuOrder[cat]||catItems.map(i=>i.id);
      // Ensure all items are in orderArr
      catItems.forEach(i=>{ if(!orderArr.includes(i.id)) orderArr.push(i.id); });
      const idx=orderArr.indexOf(id);
      if(dir==='up'&&idx>0){ [orderArr[idx-1],orderArr[idx]]=[orderArr[idx],orderArr[idx-1]]; }
      else if(dir==='down'&&idx<orderArr.length-1){ [orderArr[idx+1],orderArr[idx]]=[orderArr[idx],orderArr[idx+1]]; }
      state.menuOrder[cat]=orderArr;
      persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
    });
  });

  // Field changes
  el.querySelectorAll('.med-emoji,.med-name,.med-price,.med-cat').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const id=inp.dataset.id,field=inp.dataset.field;
      const item=MENU.find(i=>i.id===id); if(!item) return;
      if(field==='price'){
        const p=parseFloat(inp.value)||0;
        recordMenuPrice(item.name,p,item);
        item.price=p;
      } else item[field]=inp.value.trim()||item[field];
      persistMenuCatalog(); renderMenuGrid();
      if(field==='cat') renderMenuEditor();
    });
  });

  // Delete product
  el.querySelectorAll('.btn-del-menu').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('¿Eliminar este producto?')) return;
      const item=MENU.find(i=>i.id===btn.dataset.id);
      if(item) markCatalogOffMenu(item);
      MENU.splice(MENU.findIndex(i=>i.id===btn.dataset.id),1);
      persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
    });
  });

  // Delete category
  el.querySelectorAll('.btn-del-cat').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat;
      if(MENU.some(i=>i.cat===cat)){ toast('⚠️ Mueve o elimina los productos primero','error'); return; }
      delete CAT_LABELS[cat];
      persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
      toast('✔ Categoría eliminada','success');
    });
  });

  document.getElementById('btn-add-product').addEventListener('click',()=>openAddProductModal());
  document.getElementById('btn-add-category').addEventListener('click',()=>openAddCategoryModal());
  document.getElementById('btn-reset-menu').addEventListener('click',()=>{
    if(!confirm('¿Restaurar el menú original? Esto reemplaza el menú del Excel. Los costos se conservan.')) return;
    MENU.length=0; MENU_DEFAULT.forEach(i=>MENU.push(JSON.parse(JSON.stringify(i))));
    Object.keys(CAT_LABELS).forEach(k=>delete CAT_LABELS[k]);
    Object.assign(CAT_LABELS,{smash:'SMASH BURGERS',especial:'PAPAS',extras:'EXTRAS & COMPLEMENTOS',bebidas:'BEBIDAS'});
    state.menuOrder={};
    persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
    toast('✔ Menú restaurado','success');
  });
}

function getCatLabel(cat){ return CAT_LABELS[cat]||cat.toUpperCase(); }
function refreshCategoryLabels(){
  renderCategoryBtns();
  document.querySelectorAll('.med-cat option').forEach(opt=>{
    if(opt.value && opt.value!=='all') opt.textContent=getCatLabel(opt.value);
  });
  const smashT=document.getElementById('ba-title-smash');
  const papaT=document.getElementById('ba-title-papas');
  const bebT=document.getElementById('ba-title-bebidas');
  if(smashT) smashT.textContent=`${getCatLabel('smash')} MÁS VENDIDAS`;
  if(papaT) papaT.textContent=`${getCatLabel('especial')} MÁS VENDIDAS`;
  if(bebT) bebT.textContent=`${getCatLabel('bebidas')} MÁS PEDIDAS`;
}

function openAddProductModal(){
  const cats=[...new Set([...Object.keys(CAT_LABELS),...MENU.map(i=>i.cat)])];
  const sel=document.getElementById('np-cat');
  sel.innerHTML=cats.map(c=>`<option value="${c}">${getCatLabel(c)}</option>`).join('');
  document.getElementById('np-name').value='';
  document.getElementById('np-price').value='';
  document.getElementById('np-emoji').value='🍔';
  document.getElementById('modal-add-product').classList.remove('hidden');
}
function openAddCategoryModal(){
  document.getElementById('nc-name').value='';
  document.getElementById('nc-label').value='';
  document.getElementById('modal-add-category').classList.remove('hidden');
}

function initAddProductModal(){
  const modal=document.getElementById('modal-add-product');
  document.getElementById('btn-np-cancel').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  document.getElementById('btn-np-save').addEventListener('click',()=>{
    const name=document.getElementById('np-name').value.trim();
    const price=parseFloat(document.getElementById('np-price').value)||0;
    const emoji=document.getElementById('np-emoji').value.trim()||'🍔';
    const cat=document.getElementById('np-cat').value;
    if(!name){ toast('Escribe un nombre','error'); return; }
    MENU.push({id:uid(),cat,emoji,name,price});
    recordMenuPrice(name,price,{emoji,cat,name});
    persistMenuCatalog(true); modal.classList.add('hidden');
    renderMenuEditor(); renderMenuGrid(); renderCategoryBtns();
    toast('✔ Producto agregado','success');
  });
}
function initAddCategoryModal(){
  const modal=document.getElementById('modal-add-category');
  document.getElementById('btn-nc-cancel').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  document.getElementById('btn-nc-save').addEventListener('click',()=>{
    const rawName=document.getElementById('nc-name').value.trim().toLowerCase().replace(/\s+/g,'_');
    const label  =document.getElementById('nc-label').value.trim().toUpperCase();
    if(!rawName||!label){ toast('Llena nombre y etiqueta','error'); return; }
    if(CAT_LABELS[rawName]){ toast('Esa categoría ya existe','error'); return; }
    CAT_LABELS[rawName]=label;
    persistMenuCatalog(true); modal.classList.add('hidden');
    renderMenuEditor(); renderMenuGrid(); renderCategoryBtns();
    toast(`✔ Categoría "${label}" creada`,'success');
  });
}

// ─────────────────────────────────────────────
// CLIENTES TAB — sortable columns
// ─────────────────────────────────────────────
function renderClientsTab(){
  const buscar=(document.getElementById('filter-cliente-buscar')?.value||'').trim().toLowerCase();
  const map=new Map();
  state.allOrders.forEach(o=>{
    if(o['Estado']==='Cancelada') return;
    const key=`${(o['Cliente']||'').trim()}||${(o['Direccion']||'').trim()}`;
    if(!map.has(key)) map.set(key,{cliente:(o['Cliente']||'Sin nombre').trim(),direccion:(o['Direccion']||'—').trim(),count:0,total:0,ultimaFecha:''});
    const r=map.get(key);
    r.count++; r.total+=parseFloat(o['Total'])||0;
    if(!r.ultimaFecha||String(o['Fecha'])>r.ultimaFecha) r.ultimaFecha=String(o['Fecha']||'');
  });

  let rows=[...map.values()];
  if(buscar) rows=rows.filter(r=>r.cliente.toLowerCase().includes(buscar)||r.direccion.toLowerCase().includes(buscar));

  // Sort
  const {col,dir}=state.clientsSort;
  rows.sort((a,b)=>{
    let va=a[col],vb=b[col];
    if(typeof va==='string') va=va.toLowerCase(),vb=vb.toLowerCase();
    if(va<vb) return dir==='asc'?-1:1;
    if(va>vb) return dir==='asc'?1:-1;
    return 0;
  });

  const tbody=document.getElementById('clientes-tbody');
  document.getElementById('stat-total-clientes').textContent=map.size;

  // Update header arrows
  document.querySelectorAll('.clients-th[data-col]').forEach(th=>{
    const arrow=th.dataset.col===col?(dir==='asc'?' ▲':' ▼'):'';
    th.querySelector('.th-arrow').textContent=arrow;
  });

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="6" class="empty-list">Sin clientes registrados</td></tr>'; return;
  }
  tbody.innerHTML=rows.map((r,i)=>`
    <tr>
      <td class="col-num" style="color:var(--beige-dark)">${i+1}</td>
      <td><strong style="color:var(--beige)">${escHtml(r.cliente)}</strong></td>
      <td style="color:var(--beige-dark);font-size:11px">${escHtml(r.direccion)}</td>
      <td style="text-align:center">
        <span style="font-family:var(--pixel);font-size:9px;color:var(--yellow)">${r.count}</span>
      </td>
      <td class="col-total">${fmtMoney(r.total)}</td>
      <td style="font-size:11px;color:var(--beige-dark)">${r.ultimaFecha||'—'}</td>
    </tr>`).join('');
}

function initClientsTab(){
  const inp=document.getElementById('filter-cliente-buscar');
  if(inp) inp.addEventListener('input',renderClientsTab);

  document.querySelectorAll('.clients-th[data-col]').forEach(th=>{
    th.addEventListener('click',()=>{
      const col=th.dataset.col;
      if(state.clientsSort.col===col){
        state.clientsSort.dir=state.clientsSort.dir==='asc'?'desc':'asc';
      } else {
        state.clientsSort.col=col;
        state.clientsSort.dir=col==='cliente'||col==='direccion'?'asc':'desc';
      }
      renderClientsTab();
    });
  });
}

// ─────────────────────────────────────────────
// INVENTARIO (MVP)
// Después: merma %, bloquear venta, descontar historial, costos/proveedor, multi-PC
// ─────────────────────────────────────────────
function fmtInvQty(n){
  const x=Number(n); if(!isFinite(x)) return '0';
  return Math.abs(x-Math.round(x))<1e-9 ? String(Math.round(x)) : String(Math.round(x*100)/100);
}
function normInvName(s){ return String(s||'').trim().replace(/\s+/g,' ').toLowerCase(); }
function snapshotOrderInv(o){
  return { Num_Orden:o['Num_Orden'], Estado:o['Estado'], Productos:o['Productos'], Cantidades:o['Cantidades'] };
}
function findInvItem(name){
  const k=normInvName(name);
  return state.inventory.find(i=>normInvName(i['Nombre'])===k)||null;
}
function invLevel(item){
  const stock=parseFloat(item['Stock'])||0;
  const minRaw=item['Minimo'];
  const min=parseFloat(minRaw);
  const hasMin=minRaw!=='' && minRaw!=null && !isNaN(min);
  if(stock<=0) return 'red';
  if(hasMin && stock<=min) return 'yellow';
  return 'ok';
}
function normOrderNum(n){
  const s=String(n??'').trim();
  if(!s) return '';
  const num=parseInt(s,10);
  return Number.isFinite(num) ? String(num) : s;
}
function movementsNetByIng(numOrden){
  const n=normOrderNum(numOrden);
  const net={};
  if(!n) return net;
  state.movements.forEach(m=>{
    if(normOrderNum(m['Num_Orden'])!==n) return;
    const t=String(m['Tipo']||'').toLowerCase();
    if(t!=='venta' && t!=='reversion') return;
    const key=normInvName(m['Ingrediente']);
    if(!key) return;
    if(!net[key]) net[key]={ name:m['Ingrediente'], qty:0, unidad:m['Unidad']||'' };
    net[key].qty += parseFloat(m['Cantidad'])||0;
  });
  return net;
}
function recipeLinesForProduct(productName){
  const k=normInvName(productName);
  const map=new Map();
  state.recipes.forEach(r=>{
    if(normInvName(r['Producto'])!==k) return;
    const ik=normInvName(r['Ingrediente']);
    if(ik && !map.has(ik)) map.set(ik, r);
  });
  return [...map.values()];
}
function usageFromOrder(order){
  const missing=[];
  const byIng={};
  parseOrderItems(order).forEach(line=>{
    const recs=recipeLinesForProduct(line.name);
    if(!recs.length){ missing.push(line.name); return; }
    recs.forEach(r=>{
      const key=normInvName(r['Ingrediente']);
      if(!byIng[key]) byIng[key]={ name:r['Ingrediente'], qty:0, unidad:r['Unidad']||'g' };
      byIng[key].qty += (parseFloat(r['Cantidad'])||0) * (line.qty||1);
      if(r['Unidad']) byIng[key].unidad=r['Unidad'];
    });
  });
  return { missing, lines:Object.values(byIng) };
}
function pushMovement(tipo, ing, qty, unidad, numOrden, nota){
  const now=new Date();
  state.movements.push({
    Fecha:fmtDate(now), Hora:fmtTime(now), Tipo:tipo,
    Ingrediente:ing, Cantidad:qty, Unidad:unidad||'',
    Num_Orden:numOrden??'', Nota:nota||''
  });
}
function applyUsageLines(lines, sign, tipo, numOrden, nota, result){
  lines.forEach(line=>{
    const item=findInvItem(line.name);
    if(!item){
      result.missingIng.push(line.name);
      return;
    }
    const before=invLevel(item);
    const next=(parseFloat(item['Stock'])||0) + sign*line.qty;
    item['Stock']=next;
    pushMovement(tipo, item['Nombre'], sign*line.qty, item['Unidad']||line.unidad, numOrden, nota);
    const after=invLevel(item);
    const rank={ok:0,yellow:1,red:2};
    if(rank[after]>rank[before]) result.crossed.push({name:item['Nombre'], from:before, to:after, stock:next, unidad:item['Unidad']});
  });
}
function syncOrderInventory(order, opts={}){
  const result={ missing:[], missingIng:[], crossed:[], changed:false };
  if(!order) return result;
  const num=order['Num_Orden'];
  const should=!opts.deleted && String(order['Estado'])==='Entregada';
  const wanted={};
  if(should){
    const u=usageFromOrder(order);
    result.missing=u.missing;
    u.lines.forEach(l=>{
      wanted[normInvName(l.name)]={ name:l.name, qty:l.qty, unidad:l.unidad };
    });
  }
  const actual=movementsNetByIng(num);
  const keys=new Set([...Object.keys(wanted), ...Object.keys(actual)]);
  keys.forEach(k=>{
    const want=wanted[k]?.qty||0;
    const have=-(actual[k]?.qty||0);
    const delta=want-have;
    if(Math.abs(delta)<1e-9) return;
    const name=wanted[k]?.name||actual[k]?.name;
    const unidad=wanted[k]?.unidad||actual[k]?.unidad||'';
    if(delta>0){
      applyUsageLines([{ name, qty:delta, unidad }], -1, 'venta', num, 'Entrega', result);
    } else {
      applyUsageLines([{ name, qty:-delta, unidad }], +1, 'reversion', num,
        opts.deleted?'Orden eliminada':'Ajuste inventario', result);
    }
    result.changed=true;
  });
  return result;
}
function notifyInventoryResult(res){
  if(!res) return;
  if(res.missing && res.missing.length){
    const uniq=[...new Set(res.missing)];
    toast('⚠️ Sin receta (no se descontó): '+uniq.join(', '),'info',5000);
  }
  if(res.missingIng && res.missingIng.length){
    toast('⚠️ Ingrediente no está en inventario: '+[...new Set(res.missingIng)].join(', '),'error',5000);
  }
  if(res.crossed && res.crossed.length){
    const msg=res.crossed.map(c=>`${c.name} ${c.to==='red'?'🔴':'🟡'} (${fmtInvQty(c.stock)} ${c.unidad||''})`).join(' · ');
    toast('Restock: '+msg, res.crossed.some(c=>c.to==='red')?'error':'info', 6000);
  }
}
function lowInvItems(){
  return state.inventory.filter(i=>invLevel(i)!=='ok');
}
function restockBuyItems(){
  return state.inventory.map(item=>{
    const stock=parseFloat(item['Stock'])||0;
    const ideal=parseFloat(item['Ideal']);
    if(!(ideal>0) || stock>=ideal) return null;
    return { item, stock, ideal, buy: ideal-stock };
  }).filter(Boolean).sort((a,b)=>b.buy-a.buy);
}
function productsMissingRecipe(){
  const named=new Set(state.recipes.map(r=>normInvName(r['Producto'])));
  return MENU.filter(m=>!named.has(normInvName(m.name)));
}
async function persistInv(){
  if(!state.workbook){ toast('⚠️ Carga un Excel primero.','error'); return false; }
  try{ await persistWorkbook(); renderInventory(); renderDashInvAlerts(); return true; }
  catch(e){ toast('Error al guardar: '+e.message,'error'); return false; }
}
function downloadInvTemplate(){
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS]), state.sheetName);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    INV_HEADERS,
    ['Carne smash','g',2000,400,3000,'','Ejemplo — bórrame'],
    ['Pan brioche','pza',80,20,120,'',''],
    ['Tocino','g',500,100,800,'',''],
  ]), INV_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    REC_HEADERS,
    ['La Master','Carne smash',120,'g'],
    ['La Master','Pan brioche',1,'pza'],
    ['Extra Tocino','Tocino',30,'g'],
  ]), REC_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([MOV_HEADERS]), MOV_SHEET);
  const arr=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const url=URL.createObjectURL(new Blob([arr],{type:'application/octet-stream'}));
  const a=document.createElement('a'); a.href=url; a.download='LaSmashiza_Inventario_Plantilla.xlsx'; a.click();
  URL.revokeObjectURL(url);
  toast('📥 Plantilla descargada. Cópiala a tu Excel del POS o cárgala y usa Recargar.','info',6000);
}
function renderInventory(){
  const badge=document.getElementById('inv-badge');
  const lows=lowInvItems();
  if(badge){
    if(!lows.length) badge.classList.add('hidden');
    else {
      badge.classList.remove('hidden');
      badge.textContent=String(lows.length);
      badge.classList.toggle('crit', lows.some(i=>invLevel(i)==='red'));
    }
  }
  const kpis=document.getElementById('inv-kpis');
  const buy=restockBuyItems();
  if(kpis){
    kpis.innerHTML=`
      <div class="stat-card card"><div class="stat-label">INGREDIENTES</div><div class="stat-value">${state.inventory.length}</div></div>
      <div class="stat-card card"><div class="stat-label">POR COMPRAR</div><div class="stat-value" style="color:${buy.length?'var(--orange)':'var(--green)'}">${buy.length}</div></div>
      <div class="stat-card card"><div class="stat-label">SIN RECETA</div><div class="stat-value">${productsMissingRecipe().length}</div></div>`;
    kpis.parentElement?.querySelectorAll('.inv-warn').forEach(el=>el.remove());
    const dups=duplicateRecipePairs();
    if(dups.length){
      kpis.insertAdjacentHTML('afterend', `<p class="inv-warn" style="color:var(--orange);margin:8px 0">Hay recetas duplicadas (se usa solo la primera): ${dups.map(escHtml).join(', ')}</p>`);
    }
  }
  const restockBody=document.getElementById('inv-restock-tbody');
  if(restockBody){
    if(!buy.length){
      restockBody.innerHTML='<tr><td colspan="5" class="empty-list">Nada por debajo del ideal</td></tr>';
    } else {
      restockBody.innerHTML=buy.map(r=>`<tr>
        <td>${escHtml(r.item['Nombre'])}</td>
        <td>${fmtInvQty(r.stock)}</td>
        <td>${fmtInvQty(r.ideal)}</td>
        <td style="color:var(--yellow);font-weight:700">${fmtInvQty(r.buy)}</td>
        <td>${escHtml(r.item['Unidad']||'')}</td>
      </tr>`).join('');
    }
  }
  const tbody=document.getElementById('inv-tbody');
  if(tbody){
    const q=(document.getElementById('inv-search')?.value||'').trim().toLowerCase();
    const rows=state.inventory.map((item,idx)=>({item,idx}))
      .filter(r=>!q || String(r.item['Nombre']||'').toLowerCase().includes(q));
    if(!state.inventory.length){
      tbody.innerHTML='<tr><td colspan="7" class="empty-list">Sin ingredientes. Usa ＋ o la plantilla Excel.</td></tr>';
    } else if(!rows.length){
      tbody.innerHTML='<tr><td colspan="7" class="empty-list">Ningún ingrediente coincide con la búsqueda.</td></tr>';
    } else {
      tbody.innerHTML=rows.map(({item,idx})=>{
        const lvl=invLevel(item);
        const dot=lvl==='red'?'🔴':lvl==='yellow'?'🟡':'🟢';
        return `<tr class="inv-row-${lvl}" data-idx="${idx}">
          <td class="inv-dot">${dot}</td>
          <td>${escHtml(item['Nombre'])}</td>
          <td>${escHtml(item['Unidad']||'')}</td>
          <td><input type="number" class="pixel-input inv-edit-stock" data-idx="${idx}" value="${fmtInvQty(item['Stock'])}" step="any" style="width:78px"/></td>
          <td><input type="number" class="pixel-input inv-edit-min" data-idx="${idx}" value="${item['Minimo']??''}" step="any" style="width:64px"/></td>
          <td><input type="number" class="pixel-input inv-edit-ideal" data-idx="${idx}" value="${item['Ideal']??''}" step="any" style="width:64px"/></td>
          <td class="inv-stock-btns">
            <button class="btn-secondary btn-inline inv-btn-in" data-idx="${idx}" title="Entrada">+</button>
            <button class="btn-secondary btn-inline inv-btn-waste" data-idx="${idx}" title="Merma">−</button>
            <button class="btn-secondary btn-inline inv-btn-del" data-idx="${idx}" title="Quitar">✕</button>
          </td>
        </tr>`;
      }).join('');
    }
  }
  const miss=document.getElementById('inv-missing-recipes');
  if(miss){
    const list=productsMissingRecipe();
    miss.textContent=list.length?('Sin receta aún: '+list.map(m=>m.name).join(', ')):'Todas las recetas del menú tienen al menos un ingrediente.';
  }
  renderRecipeBoard();
}
function duplicateRecipePairs(){
  const seen=new Set(), dups=new Set();
  state.recipes.forEach(r=>{
    const k=normInvName(r['Producto'])+'||'+normInvName(r['Ingrediente']);
    if(seen.has(k)) dups.add(`${r['Producto']} + ${r['Ingrediente']}`);
    else seen.add(k);
  });
  return [...dups];
}
function recipeDraftKey(name){ return normInvName(name); }
function savedRecipeDraft(name){
  return recipeLinesForProduct(name).map(r=>({
    name:r['Ingrediente'], qty:parseFloat(r['Cantidad'])||0, unidad:r['Unidad']||''
  }));
}
function getRecipeDraft(name){
  if(!state.recipeDrafts) state.recipeDrafts={};
  const k=recipeDraftKey(name);
  if(!state.recipeDrafts[k]) state.recipeDrafts[k]=savedRecipeDraft(name);
  return state.recipeDrafts[k];
}
function recipeDraftDirty(name){
  const d=getRecipeDraft(name);
  const s=savedRecipeDraft(name);
  if(d.length!==s.length) return true;
  const sig=arr=>arr.map(l=>normInvName(l.name)+':'+Number(l.qty)).sort().join('|');
  return sig(d)!==sig(s);
}
function ingOptionsHtml(selected, skipSet){
  const skip=skipSet||new Set();
  const rows=state.inventory.filter(i=>!skip.has(normInvName(i['Nombre'])) || normInvName(i['Nombre'])===normInvName(selected||''));
  if(!rows.length) return '<option value="">Sin ingredientes</option>';
  return rows.map(i=>{
    const n=i['Nombre'];
    return `<option value="${escHtml(n)}" ${n===selected?'selected':''}>${escHtml(n)}</option>`;
  }).join('');
}
function visibleRecipeProducts(){
  const ui=state.recipeUi||{cat:'all',q:''};
  const q=(ui.q||'').trim().toLowerCase();
  return MENU.filter(m=>{
    if(ui.cat && ui.cat!=='all' && m.cat!==ui.cat) return false;
    if(q && !(`${m.name} ${m.emoji} ${getCatLabel(m.cat)}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
function renderRecipeBoard(){
  const board=document.getElementById('rec-board');
  if(!board) return;
  if(!state.recipeUi) state.recipeUi={ cat:'all', q:'', open:new Set(), collapsed:{} };
  const ui=state.recipeUi;
  const chips=document.getElementById('rec-cat-chips');
  if(chips){
    const cats=menuCatsInOrder();
    chips.innerHTML=[
      `<button type="button" class="rec-chip ${ui.cat==='all'?'active':''}" data-cat="all">TODAS</button>`,
      ...cats.map(c=>`<button type="button" class="rec-chip ${ui.cat===c?'active':''}" data-cat="${escHtml(c)}">${escHtml(getCatLabel(c))}</button>`)
    ].join('');
  }
  const bulkIng=document.getElementById('rec-bulk-ing');
  if(bulkIng){
    const cur=bulkIng.value;
    bulkIng.innerHTML='<option value="">Ingrediente a cambiar…</option>'+ingOptionsHtml(cur);
    if(cur && state.inventory.some(i=>i['Nombre']===cur)) bulkIng.value=cur;
  }
  const search=document.getElementById('rec-search');
  if(search && search.value!==(ui.q||'') && document.activeElement!==search) search.value=ui.q||'';

  const visible=visibleRecipeProducts();
  const byCat=new Map();
  visible.forEach(m=>{
    if(!byCat.has(m.cat)) byCat.set(m.cat, []);
    byCat.get(m.cat).push(m);
  });
  const catOrder=menuCatsInOrder().filter(c=>byCat.has(c));
  if(!visible.length){
    board.innerHTML='<div class="empty-list">Ningún producto coincide.</div>';
    return;
  }
  board.innerHTML=catOrder.map(cat=>{
    const items=orderedMenuItems(cat).filter(m=>visible.some(v=>v.name===m.name));
    const withRec=items.filter(m=>recipeLinesForProduct(m.name).length).length;
    const collapsed=!!ui.collapsed[cat];
    return `<section class="rec-cat" data-cat="${escHtml(cat)}">
      <button type="button" class="rec-cat-toggle" data-cat="${escHtml(cat)}">
        <span class="rec-cat-name">${escHtml(getCatLabel(cat))}</span>
        <span class="rec-cat-meta">${withRec}/${items.length} con receta ${collapsed?'▶':'▼'}</span>
      </button>
      <div class="rec-cat-body ${collapsed?'hidden':''}">${items.map(m=>recipeProductHtml(m)).join('')}</div>
    </section>`;
  }).join('');
}
function recipeProductHtml(m){
  const saved=recipeLinesForProduct(m.name);
  const draft=getRecipeDraft(m.name);
  const dirty=recipeDraftDirty(m.name);
  const open=state.recipeUi.open.has(m.name);
  const pill=dirty?'<span class="rec-pill dirty">SIN GUARDAR</span>'
    : (saved.length?'<span class="rec-pill ok">'+saved.length+' ING</span>':'<span class="rec-pill miss">SIN RECETA</span>');
  const used=new Set(draft.map(l=>normInvName(l.name)));
  const addOpts=ingOptionsHtml('', used);
  const copyOpts=MENU.filter(x=>x.name!==m.name).map(x=>`<option value="${escHtml(x.name)}">${escHtml(x.name)}</option>`).join('');
  const lines=draft.length?draft.map((l,i)=>{
    const item=findInvItem(l.name);
    const unidad=item?item['Unidad']:(l.unidad||'');
    return `<div class="rec-line" data-idx="${i}">
      <select class="pixel-input rec-ing">${ingOptionsHtml(l.name)}</select>
      <input type="number" class="pixel-input rec-qty" value="${l.qty||''}" step="any" min="0"/>
      <span class="rec-unit">${escHtml(unidad)}</span>
      <button type="button" class="btn-secondary btn-inline rec-del">✕</button>
    </div>`;
  }).join(''):'<div class="empty-list">Sin ingredientes. Agrégalos abajo.</div>';
  return `<article class="rec-prod ${saved.length?'':'missing'} ${dirty?'dirty':''}" data-prod="${escHtml(m.name)}">
    <button type="button" class="rec-prod-head">
      <span class="rec-prod-title">${m.emoji} ${escHtml(m.name)}</span>
      <span class="rec-prod-meta">${pill}</span>
    </button>
    <div class="rec-prod-body ${open?'':'hidden'}">
      <div class="rec-copy-row">
        <select class="pixel-input rec-copy-src"><option value="">Copiar receta de…</option>${copyOpts}</select>
        <button type="button" class="btn-secondary btn-inline rec-copy-btn">COPIAR</button>
      </div>
      <div class="rec-lines">${lines}</div>
      <div class="rec-add-row">
        <select class="pixel-input rec-add-ing"><option value="">＋ Ingrediente</option>${addOpts}</select>
        <input type="number" class="pixel-input rec-add-qty" placeholder="Cant." step="any" min="0"/>
        <button type="button" class="btn-primary rec-add-btn" style="width:auto;padding:.4rem .7rem;margin:0">＋</button>
      </div>
      <div class="rec-newing-row">
        <input type="text" class="pixel-input rec-new-name" placeholder="Nuevo ingrediente"/>
        <select class="pixel-input rec-new-unit"><option value="g">g</option><option value="ml">ml</option><option value="pza">pza</option></select>
        <input type="number" class="pixel-input rec-new-qty" placeholder="Cant." step="any" min="0"/>
        <button type="button" class="btn-secondary btn-inline rec-new-btn">CREAR Y AGREGAR</button>
      </div>
      <div class="rec-actions">
        <button type="button" class="btn-primary rec-save-btn" style="width:auto;padding:.5rem 1rem">► GUARDAR RECETA</button>
        <button type="button" class="btn-secondary rec-revert-btn" style="width:auto;margin:0">DESCARTAR</button>
      </div>
    </div>
  </article>`;
}
function writeProductRecipes(productName, lines){
  const pk=normInvName(productName);
  state.recipes=state.recipes.filter(r=>normInvName(r['Producto'])!==pk);
  lines.forEach(l=>{
    if(!l.name || !(parseFloat(l.qty)>0)) return;
    const item=findInvItem(l.name);
    state.recipes.push({
      Producto:productName,
      Ingrediente:item?item['Nombre']:l.name,
      Cantidad:parseFloat(l.qty),
      Unidad:item?item['Unidad']:(l.unidad||'g')
    });
  });
}
async function saveRecipeProduct(productName){
  writeProductRecipes(productName, getRecipeDraft(productName));
  delete state.recipeDrafts[recipeDraftKey(productName)];
  const ok=await persistInv();
  if(ok) toast('✔ Receta de '+productName+' guardada','success');
}
function initInventoryTab(){
  const add=document.getElementById('btn-inv-add');
  if(!add) return;
  add.addEventListener('click',async()=>{
    const name=document.getElementById('inv-new-name').value.trim();
    if(!name){ toast('Pon un nombre de ingrediente','error'); return; }
    if(findInvItem(name)){ toast('Ya existe ese ingrediente','error'); return; }
    const unidad=document.getElementById('inv-new-unit').value;
    const stock=parseFloat(document.getElementById('inv-new-stock').value)||0;
    const minimo=document.getElementById('inv-new-min').value;
    const ideal=document.getElementById('inv-new-ideal').value;
    state.inventory.push({ Nombre:name, Unidad:unidad, Stock:stock, Minimo:minimo, Ideal:ideal, Proveedor:'', Nota:'' });
    if(stock) pushMovement('compra', name, stock, unidad, '', 'Stock inicial');
    document.getElementById('inv-new-name').value='';
    document.getElementById('inv-new-stock').value='';
    document.getElementById('inv-new-min').value='';
    document.getElementById('inv-new-ideal').value='';
    await persistInv();
    toast('✔ Ingrediente agregado','success');
  });
  document.getElementById('btn-inv-template').addEventListener('click',downloadInvTemplate);
  document.getElementById('btn-inv-reload').addEventListener('click',reloadExcel);
  const invSearch=document.getElementById('inv-search');
  if(invSearch) invSearch.addEventListener('input',renderInventory);
  initRecipeBoard();
  document.getElementById('inv-tbody').addEventListener('change',async e=>{
    const idx=parseInt(e.target.dataset.idx);
    const item=state.inventory[idx]; if(!item) return;
    if(e.target.classList.contains('inv-edit-stock')){
      const next=parseFloat(e.target.value); if(isNaN(next)) return;
      const prev=parseFloat(item['Stock'])||0;
      const delta=next-prev;
      if(Math.abs(delta)<1e-9) return;
      item['Stock']=next;
      pushMovement('ajuste', item['Nombre'], delta, item['Unidad'], '', 'Edición manual de stock');
      await persistInv();
    }
    if(e.target.classList.contains('inv-edit-min')){ item['Minimo']=e.target.value; await persistInv(); }
    if(e.target.classList.contains('inv-edit-ideal')){ item['Ideal']=e.target.value; await persistInv(); }
  });
  document.getElementById('inv-tbody').addEventListener('click',async e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const idx=parseInt(btn.dataset.idx);
    const item=state.inventory[idx]; if(!item) return;
    if(btn.classList.contains('inv-btn-del')){
      if(!confirm(`¿Quitar ${item['Nombre']} del inventario?`)) return;
      const k=normInvName(item['Nombre']);
      state.inventory.splice(idx,1);
      state.recipes=state.recipes.filter(r=>normInvName(r['Ingrediente'])!==k);
      await persistInv();
      return;
    }
    const kind=btn.classList.contains('inv-btn-in')?'compra':'merma';
    document.getElementById('inv-move-name').value=item['Nombre'];
    document.getElementById('inv-move-kind').value=kind;
    document.getElementById('inv-move-title').textContent=kind==='compra'?'＋ ENTRADA DE STOCK':'MERMA';
    document.getElementById('inv-move-ing').textContent=`${item['Nombre']} · actual ${fmtInvQty(item['Stock'])} ${item['Unidad']||''}`;
    document.getElementById('inv-move-label').textContent=kind==='compra'?'CANTIDAD QUE ENTRA':'CANTIDAD DE MERMA';
    document.getElementById('inv-move-qty').value='';
    document.getElementById('inv-move-nota').value='';
    document.getElementById('modal-inv-move').classList.remove('hidden');
    document.getElementById('inv-move-qty').focus();
  });
  const moveModal=document.getElementById('modal-inv-move');
  document.getElementById('btn-inv-move-cancel').addEventListener('click',()=>moveModal.classList.add('hidden'));
  moveModal.addEventListener('click',e=>{ if(e.target===moveModal) moveModal.classList.add('hidden'); });
  document.getElementById('btn-inv-move-save').addEventListener('click',async()=>{
    const name=document.getElementById('inv-move-name').value;
    const kind=document.getElementById('inv-move-kind').value;
    const item=findInvItem(name); if(!item) return;
    const qty=parseFloat(document.getElementById('inv-move-qty').value);
    if(!qty||qty<=0){ toast('Cantidad inválida','error'); return; }
    const nota=document.getElementById('inv-move-nota').value.trim();
    if(kind==='compra'){
      item['Stock']=(parseFloat(item['Stock'])||0)+qty;
      pushMovement('compra', item['Nombre'], qty, item['Unidad'], '', nota||'Entrada de stock');
    } else {
      item['Stock']=(parseFloat(item['Stock'])||0)-qty;
      pushMovement('merma', item['Nombre'], -qty, item['Unidad'], '', nota||'Merma');
    }
    moveModal.classList.add('hidden');
    await persistInv();
  });
}
function initRecipeBoard(){
  const chips=document.getElementById('rec-cat-chips');
  if(chips){
    chips.addEventListener('click',e=>{
      const btn=e.target.closest('[data-cat]'); if(!btn) return;
      state.recipeUi.cat=btn.dataset.cat||'all';
      renderRecipeBoard();
    });
  }
  const search=document.getElementById('rec-search');
  if(search){
    search.addEventListener('input',()=>{
      state.recipeUi.q=search.value;
      renderRecipeBoard();
    });
  }
  const bulkBtn=document.getElementById('btn-rec-bulk');
  if(bulkBtn) bulkBtn.addEventListener('click',applyRecipeBulk);
  const board=document.getElementById('rec-board');
  if(!board) return;
  board.addEventListener('click',async e=>{
    const catBtn=e.target.closest('.rec-cat-toggle');
    if(catBtn){
      const cat=catBtn.dataset.cat;
      state.recipeUi.collapsed[cat]=!state.recipeUi.collapsed[cat];
      renderRecipeBoard();
      return;
    }
    const prodEl=e.target.closest('.rec-prod');
    if(!prodEl) return;
    const name=prodEl.dataset.prod;
    if(e.target.closest('.rec-prod-head')){
      if(state.recipeUi.open.has(name)) state.recipeUi.open.delete(name);
      else state.recipeUi.open.add(name);
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-del')){
      const idx=parseInt(e.target.closest('.rec-line')?.dataset.idx);
      const draft=getRecipeDraft(name);
      if(!isNaN(idx)) draft.splice(idx,1);
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-add-btn')){
      const ing=prodEl.querySelector('.rec-add-ing')?.value;
      const qty=parseFloat(prodEl.querySelector('.rec-add-qty')?.value);
      if(!ing){ toast('Elige un ingrediente','error'); return; }
      if(!(qty>0)){ toast('Pon una cantidad','error'); return; }
      const draft=getRecipeDraft(name);
      const item=findInvItem(ing);
      const ex=draft.find(l=>normInvName(l.name)===normInvName(ing));
      if(ex) ex.qty=qty;
      else draft.push({ name:item?item['Nombre']:ing, qty, unidad:item?item['Unidad']:'g' });
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-copy-btn')){
      const src=prodEl.querySelector('.rec-copy-src')?.value;
      if(!src){ toast('Elige de qué producto copiar','error'); return; }
      state.recipeDrafts[recipeDraftKey(name)]=savedRecipeDraft(src).map(l=>({...l}));
      if(!savedRecipeDraft(src).length) toast('Ese producto no tiene receta guardada','error');
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-new-btn')){
      const newName=(prodEl.querySelector('.rec-new-name')?.value||'').trim();
      const unidad=prodEl.querySelector('.rec-new-unit')?.value||'g';
      const qty=parseFloat(prodEl.querySelector('.rec-new-qty')?.value);
      if(!newName){ toast('Pon el nombre del ingrediente','error'); return; }
      if(!(qty>0)){ toast('Pon una cantidad','error'); return; }
      if(!findInvItem(newName)){
        state.inventory.push({ Nombre:newName, Unidad:unidad, Stock:0, Minimo:'', Ideal:'', Proveedor:'', Nota:'' });
        const persisted=await persistInv();
        if(!persisted) return;
      }
      const item=findInvItem(newName);
      const draft=getRecipeDraft(name);
      const ex=draft.find(l=>normInvName(l.name)===normInvName(newName));
      if(ex){ ex.qty=qty; ex.unidad=item?item['Unidad']:unidad; }
      else draft.push({ name:item?item['Nombre']:newName, qty, unidad:item?item['Unidad']:unidad });
      state.recipeUi.open.add(name);
      renderRecipeBoard();
      toast('Ingrediente listo. Guarda la receta cuando termines.','info');
      return;
    }
    if(e.target.closest('.rec-save-btn')){
      await saveRecipeProduct(name);
      return;
    }
    if(e.target.closest('.rec-revert-btn')){
      delete state.recipeDrafts[recipeDraftKey(name)];
      renderRecipeBoard();
    }
  });
  const syncLine=e=>{
    const prodEl=e.target.closest('.rec-prod'); if(!prodEl) return;
    const name=prodEl.dataset.prod;
    const line=e.target.closest('.rec-line'); if(!line) return;
    const idx=parseInt(line.dataset.idx);
    const draft=getRecipeDraft(name);
    if(!draft[idx]) return;
    if(e.target.classList.contains('rec-ing')){
      const item=findInvItem(e.target.value);
      draft[idx].name=item?item['Nombre']:e.target.value;
      draft[idx].unidad=item?item['Unidad']:draft[idx].unidad;
    }
    if(e.target.classList.contains('rec-qty')){
      draft[idx].qty=parseFloat(e.target.value)||0;
    }
    const head=prodEl.querySelector('.rec-prod-meta');
    if(head) head.innerHTML=recipeDraftDirty(name)?'<span class="rec-pill dirty">SIN GUARDAR</span>'
      : '<span class="rec-pill ok">'+getRecipeDraft(name).length+' ING</span>';
    prodEl.classList.toggle('dirty', recipeDraftDirty(name));
  };
  board.addEventListener('change',syncLine);
  board.addEventListener('input',e=>{ if(e.target.classList.contains('rec-qty')) syncLine(e); });
}
async function applyRecipeBulk(){
  const ing=document.getElementById('rec-bulk-ing')?.value;
  const qty=parseFloat(document.getElementById('rec-bulk-qty')?.value);
  const addMissing=!!document.getElementById('rec-bulk-add')?.checked;
  if(!ing){ toast('Elige el ingrediente a cambiar','error'); return; }
  if(!(qty>0)){ toast('Pon la cantidad nueva','error'); return; }
  const item=findInvItem(ing); if(!item){ toast('Ese ingrediente no está en stock','error'); return; }
  const vis=visibleRecipeProducts();
  if(!vis.length){ toast('No hay productos visibles','error'); return; }
  const ik=normInvName(item['Nombre']);
  let n=0;
  vis.forEach(m=>{
    const draft=getRecipeDraft(m.name);
    const line=draft.find(l=>normInvName(l.name)===ik);
    if(line){ line.qty=qty; line.unidad=item['Unidad']; n++; }
    else if(addMissing){ draft.push({ name:item['Nombre'], qty, unidad:item['Unidad'] }); n++; }
  });
  if(!n){ toast('Ningún producto visible tenía '+item['Nombre']+' (marca “agrégalo” si quieres)','info'); return; }
  if(!confirm(`¿Poner ${item['Nombre']} = ${fmtInvQty(qty)} ${item['Unidad']||''} en ${n} producto(s) visible(s) y guardar?`)) return;
  vis.forEach(m=>writeProductRecipes(m.name, getRecipeDraft(m.name)));
  vis.forEach(m=>delete state.recipeDrafts[recipeDraftKey(m.name)]);
  const ok=await persistInv();
  if(ok) toast(`✔ ${item['Nombre']} actualizado en ${n} recetas`,'success');
}

function runInventorySelfTest(){
  const snap={
    inventory:state.inventory, recipes:state.recipes, movements:state.movements, allOrders:state.allOrders
  };
  const fail=[];
  const expect=(name, got, want)=>{
    const g=Number(got), w=Number(want);
    if(Math.abs(g-w)>1e-9) fail.push(`${name}: got ${g}, want ${w}`);
  };
  try{
    state.inventory=[{ Nombre:'Pan', Unidad:'pza', Stock:10, Minimo:0, Ideal:20, Proveedor:'', Nota:'' }];
    state.recipes=[{ Producto:'La Master', Ingrediente:'Pan', Cantidad:1, Unidad:'pza' }];
    state.movements=[];
    state.allOrders=[];
    const order={ Num_Orden:99, Estado:'Entregada', Productos:'La Master', Cantidades:'5x' };
    syncOrderInventory(order);
    expect('after 1st deliver', state.inventory[0].Stock, 5);
    syncOrderInventory(order);
    expect('after 2nd deliver (idempotent)', state.inventory[0].Stock, 5);
    order.Estado='Lista';
    syncOrderInventory(order);
    expect('after leave Entregada', state.inventory[0].Stock, 10);
    order.Estado='Entregada';
    syncOrderInventory(order);
    expect('after deliver again', state.inventory[0].Stock, 5);
    const leaked=10-5-2;
    state.inventory[0].Stock=3;
    state.movements=[
      { Tipo:'venta', Ingrediente:'Pan', Cantidad:-5, Num_Orden:99, Unidad:'pza' },
      { Tipo:'venta', Ingrediente:'Pan', Cantidad:-2, Num_Orden:99, Unidad:'pza' }
    ];
    order.Estado='Entregada';
    syncOrderInventory(order);
    expect('heal 10-5-2=3 back to 5', state.inventory[0].Stock, 5);
    if(leaked!==3) fail.push('fixture math');
  } finally {
    state.inventory=snap.inventory; state.recipes=snap.recipes;
    state.movements=snap.movements; state.allOrders=snap.allOrders;
  }
  const ok=!fail.length;
  console[ok?'log':'error'](ok?'[Smashiza test] inventario OK':'[Smashiza test] FAIL\n'+fail.join('\n'));
  toast(ok?'✔ Test inventario OK (datos demo, tu Excel no se tocó)':'❌ Test inventario: '+fail[0],ok?'success':'error',7000);
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  startClock();
  setupScreen();
  initNav();
  initChangeExcel();
  initPayToggle();
  initCategoryBtns();
  initMenuSearch();
  initOrdersFilter();
  initOrderDetailModal();
  initAddProductModal();
  initAddCategoryModal();
  initClienteAutocomplete();
  initAjuste();
  renderMenuGrid();
  renderMenuEditor();
  initDashboardFilter();
  initClientsTab();
  initBATab();
  initInventoryTab();
  document.getElementById('btn-guardar-orden').addEventListener('click',saveOrder);
  document.getElementById('btn-limpiar-orden').addEventListener('click',clearForm);
  stampNewOrderWhen();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(/[?&]test=1(?:&|$)/.test(location.search)) runInventorySelfTest();
});

// ═══════════════════════════════════════════════════════════
//  BUSINESS ANALYSIS TAB  v2
//  Fixes: client grouping, coto parsing, slicers, cost editor,
//         hour drill-down, new products in costs
// ═══════════════════════════════════════════════════════════

// ── COST PERSISTENCE ──────────────────────────────────────
function loadCosts(){
  return loadCatalog().costs;
}
function saveCosts(partial, removeEmptyFrom){
  const cat=loadCatalog();
  if(removeEmptyFrom){
    removeEmptyFrom.forEach(name=>{
      if(partial[name]==null) delete cat.costs[name];
    });
  }
  Object.keys(partial).forEach(k=>{ cat.costs[k]=partial[k]; });
  saveCatalog(cat);
}
function loadCatalog(){
  if(catalogCache) return catalogCache;
  try{
    const raw=JSON.parse(localStorage.getItem('smashiza_catalog_v1')||'null');
    if(raw && typeof raw==='object'){
      catalogCache={ costs: raw.costs||{}, items: raw.items||{} };
      return catalogCache;
    }
  }catch(_){}
  let costs={};
  try{ costs=JSON.parse(localStorage.getItem('smashiza_costs')||'{}'); }catch(_){}
  catalogCache={ costs, items:{} };
  return catalogCache;
}
function saveCatalog(cat){
  catalogCache=cat;
  try{ localStorage.setItem('smashiza_catalog_v1', JSON.stringify(cat)); }
  catch(_){}
}
function soldProductNames(){
  const s=new Set();
  (state.allOrders||[]).forEach(o=>parseOrderItems(o).forEach(({name})=>{ if(name) s.add(name); }));
  return s;
}
function ensureCatalogItem(cat, name, extra={}){
  if(!cat.items[name]) cat.items[name]={ emoji:extra.emoji||'🍽️', cat:extra.cat||'', inMenu:!!extra.inMenu, priceHistory:[] };
  if(extra.emoji) cat.items[name].emoji=extra.emoji;
  if(extra.cat) cat.items[name].cat=extra.cat;
  if(extra.inMenu!=null) cat.items[name].inMenu=extra.inMenu;
  return cat.items[name];
}
function recordMenuPrice(name, price, extra={}){
  const cat=loadCatalog();
  const it=ensureCatalogItem(cat,name,{...extra,name,inMenu:true});
  const p=Number(price)||0;
  const hist=it.priceHistory||[];
  const last=hist[hist.length-1];
  const d=today();
  if(!hist.length) hist.push({from:'2000-01-01',price:p});
  else if(last.price!==p){
    if(last.from===d) last.price=p;
    else hist.push({from:d,price:p});
  }
  it.priceHistory=hist;
  saveCatalog(cat);
}
function markCatalogOffMenu(item){
  if(!item) return;
  const cat=loadCatalog();
  const it=ensureCatalogItem(cat,item.name,{emoji:item.emoji,cat:item.cat,inMenu:false});
  it.inMenu=false;
  const p=Number(item.price)||0;
  const hist=it.priceHistory||[];
  if(!hist.length) hist.push({from:'2000-01-01',price:p});
  it.priceHistory=hist;
  saveCatalog(cat);
}
function syncCatalogFromMenu(){
  const cat=loadCatalog();
  const menuNames=new Set(MENU.map(m=>m.name));
  MENU.forEach(m=>{
    const it=ensureCatalogItem(cat,m.name,{emoji:m.emoji,cat:m.cat,inMenu:true});
    it.inMenu=true;
    const p=Number(m.price)||0;
    if(!it.priceHistory.length) it.priceHistory.push({from:'2000-01-01',price:p});
  });
  Object.keys(cat.items).forEach(n=>{
    if(!menuNames.has(n)) cat.items[n].inMenu=false;
  });
  soldProductNames().forEach(n=>{
    if(!cat.items[n]) ensureCatalogItem(cat,n,{inMenu:menuNames.has(n)});
  });
  saveCatalog(cat);
  return cat;
}
function priceAt(name, fecha){
  const cat=loadCatalog();
  const hist=(cat.items[name]?.priceHistory||[]).slice().sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  if(!hist.length){
    const m=MENU.find(i=>i.name===name);
    return m?Number(m.price)||0:0;
  }
  const f=String(fecha||'').slice(0,10);
  let p=hist[0].price;
  hist.forEach(h=>{ if(String(h.from)<=f) p=h.price; });
  return Number(p)||0;
}
function costEditorRows(){
  const cat=syncCatalogFromMenu();
  const sold=soldProductNames();
  const names=new Set([...MENU.map(m=>m.name),...sold]);
  return [...names].map(name=>{
    const m=MENU.find(i=>i.name===name);
    const c=cat.items[name]||{};
    return {
      name,
      emoji:m?m.emoji:(c.emoji||'🍽️'),
      cat:m?m.cat:(c.cat||'otros'),
      price:m?m.price:priceAt(name,today()),
      inMenu:!!m,
    };
  });
}

// ── COTO EXTRACTION ───────────────────────────────────────
// "Av Campiña 5424" → "AV CAMPIÑA"
// "Manyara 23"      → "MANYARA"
// "Lemon 45"        → "LEMON"
function extractCoto(direccion){
  const parts = String(direccion||'').trim().split(/\s+/);
  const words = parts.filter(p => !/^\d+$/.test(p)); // strip pure-number tokens
  return words.join(' ').toUpperCase() || 'SIN COTO';
}

// ── FILTER STATE ──────────────────────────────────────────
const baRange = { start:null, end:null, picking:false, hovering:null,
                  _viewYear:new Date().getFullYear(), _viewMonth:new Date().getMonth() };

// Selected slicer values (Sets of strings, empty = all)
const baSlicers = { cotos: new Set(), clientes: new Set() };

// ── SLICER DATA ───────────────────────────────────────────
function getAllCotos(){
  const s = new Set();
  state.allOrders.filter(o=>o['Estado']!=='Cancelada')
    .forEach(o=>s.add(extractCoto(o['Direccion'])));
  return [...s].sort();
}
function getAllClientNames(){
  const s = new Set();
  state.allOrders.filter(o=>o['Estado']!=='Cancelada')
    .forEach(o=>s.add((o['Cliente']||'Sin nombre').trim()));
  return [...s].sort();
}

// ── ORDER FILTER ──────────────────────────────────────────
function getBAOrders(){
  let orders = state.allOrders.filter(o=>o['Estado']!=='Cancelada');
  if(baRange.start){
    const s=baRange.start, e=baRange.end||baRange.start;
    orders=orders.filter(o=>{ const f=String(o['Fecha']||''); return f>=s&&f<=e; });
  }
  if(baSlicers.cotos.size>0){
    orders=orders.filter(o=>baSlicers.cotos.has(extractCoto(o['Direccion'])));
  }
  if(baSlicers.clientes.size>0){
    orders=orders.filter(o=>baSlicers.clientes.has((o['Cliente']||'Sin nombre').trim()));
  }
  return orders;
}

function parseOrderItems(order){
  const prods=String(order['Productos']||'').split(' | ').filter(Boolean);
  const qtys =String(order['Cantidades']||'').split(' | ');
  return prods.map((name,i)=>({ name, qty:parseInt(qtys[i])||1 }));
}

// ── SLICER RENDERER — dropdown multi-select ───────────────
function renderBASlicers(){
  renderDropdownSlicer('ba-slicer-cotos',   getAllCotos(),       baSlicers.cotos,   '🏘️ ZONA / COTO');
  renderDropdownSlicer('ba-slicer-clientes', getAllClientNames(), baSlicers.clientes,'👤 CLIENTE');
}

function renderDropdownSlicer(containerId, options, selectedSet, label){
  const wrap=document.getElementById(containerId);
  if(!wrap) return;

  // Build select element
  const selectId=containerId+'-select';
  const allSelected=selectedSet.size===0;

  wrap.innerHTML=`
    <div class="slicer-label">${label}</div>
    <select id="${selectId}" class="pixel-input slicer-select" multiple size="${Math.min(options.length+1,6)}">
      <option value="__all__" ${allSelected?'selected':''}>— TODOS —</option>
      ${options.map(opt=>`
        <option value="${escHtml(opt)}" ${selectedSet.has(opt)?'selected':''}>${escHtml(opt)}</option>
      `).join('')}
    </select>
    ${selectedSet.size>0?`<div class="slicer-active-hint">${selectedSet.size} seleccionado${selectedSet.size>1?'s':''}</div>`:''}`;

  wrap.querySelector('select').addEventListener('change', function(){
    selectedSet.clear();
    const selected=[...this.selectedOptions].map(o=>o.value);
    if(selected.includes('__all__')||selected.length===0){
      selectedSet.clear();
      // Deselect everything except "TODOS"
      [...this.options].forEach(o=>o.selected=(o.value==='__all__'));
    } else {
      selected.filter(v=>v!=='__all__').forEach(v=>selectedSet.add(v));
    }
    renderBASlicers(); // refresh hint text
    renderBA();
  });
}

// ── RANGE PICKER (BA version) ─────────────────────────────
function initBARangePicker(){
  document.getElementById('btn-ba-hoy').addEventListener('click',()=>{
    baRange.start=today(); baRange.end=today(); baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });
  document.getElementById('btn-ba-semana').addEventListener('click',()=>{
    const d=new Date(); d.setDate(d.getDate()-6);
    baRange.start=fmtDate(d); baRange.end=today(); baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });
  document.getElementById('btn-ba-mes').addEventListener('click',()=>{
    const d=new Date(); d.setDate(1);
    baRange.start=fmtDate(d); baRange.end=today(); baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });
  document.getElementById('btn-ba-todo').addEventListener('click',()=>{
    baRange.start=null; baRange.end=null; baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });

  const tog=document.getElementById('btn-ba-toggle-cal');
  const cal=document.getElementById('ba-cal-collapse');
  let open=false;
  function setOpen(v){ open=v; cal.classList.toggle('hidden',!v); tog.textContent=v?'📅 OCULTAR ▲':'📅 RANGO DE FECHAS ▼'; }
  setOpen(false);
  tog.addEventListener('click',()=>setOpen(!open));

  document.getElementById('btn-ba-cal-prev').addEventListener('click',()=>{
    baRange._viewMonth--; if(baRange._viewMonth<0){baRange._viewMonth=11;baRange._viewYear--;} reBuildBAMonths();
  });
  document.getElementById('btn-ba-cal-next').addEventListener('click',()=>{
    baRange._viewMonth++; if(baRange._viewMonth>11){baRange._viewMonth=0;baRange._viewYear++;} reBuildBAMonths();
  });

  reBuildBAMonths();

  const wrap=document.getElementById('ba-cal-months-wrap');
  wrap.addEventListener('click',e=>{
    const el=e.target.closest('.cal-day[data-date]'); if(!el) return;
    const d=el.dataset.date;
    if(!baRange.picking){ baRange.start=d; baRange.end=null; baRange.picking=true; baRange.hovering=null; }
    else{
      if(d<baRange.start){baRange.end=baRange.start;baRange.start=d;}else baRange.end=d;
      baRange.picking=false; baRange.hovering=null;
      updateBARangeLabel(); renderBA();
      document.getElementById('ba-cal-collapse').classList.add('hidden');
      document.getElementById('btn-ba-toggle-cal').textContent='📅 RANGO DE FECHAS ▼';
    }
    reBuildBAMonths();
  });
  wrap.addEventListener('mouseover',e=>{
    if(!baRange.picking) return;
    const el=e.target.closest('.cal-day[data-date]'); if(!el) return;
    if(baRange.hovering===el.dataset.date) return;
    baRange.hovering=el.dataset.date; reBuildBAMonths();
  });
  wrap.addEventListener('mouseleave',()=>{ if(baRange.picking&&baRange.hovering){baRange.hovering=null;reBuildBAMonths();} });
}

function updateBARangeLabel(){
  const lbl=document.getElementById('ba-range-label');
  if(!lbl) return;
  if(!baRange.start) lbl.textContent='Todo el historial';
  else if(!baRange.end||baRange.start===baRange.end) lbl.textContent=baRange.start;
  else lbl.textContent=`${baRange.start} → ${baRange.end}`;
}

function reBuildBAMonths(){
  const yr=baRange._viewYear, mo=baRange._viewMonth;
  const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;
  const datesWithOrders=new Set(state.allOrders.map(o=>String(o['Fecha'])));

  function buildBAMonth(year,month){
    const MN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DN=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
    const first=new Date(year,month,1).getDay();
    const days=new Date(year,month+1,0).getDate();
    const hover=baRange.hovering;
    const re=baRange.picking&&hover?(hover>baRange.start?hover:baRange.start):baRange.end;
    const rs=baRange.picking&&hover&&hover<baRange.start?hover:baRange.start;
    let h=`<div class="cal-month-title">${MN[month]} ${year}</div><div class="cal-grid">`;
    DN.forEach(d=>{ h+=`<div class="cal-header-day">${d}</div>`; });
    for(let i=0;i<first;i++) h+=`<div class="cal-day cal-empty"></div>`;
    for(let day=1;day<=days;day++){
      const ds=`${year}-${pad(month+1)}-${pad(day)}`;
      const isSt=ds===baRange.start, isEn=ds===(baRange.end||(baRange.picking&&hover?hover:null));
      const inR=rs&&re&&ds>rs&&ds<re;
      let cls='cal-day';
      if(isSt) cls+=' cal-start'; else if(isEn) cls+=' cal-end'; else if(inR) cls+=' cal-in-range';
      if(ds===today()) cls+=' cal-today';
      h+=`<div class="${cls}" data-date="${ds}">${day}${datesWithOrders.has(ds)?'<span class="cal-dot"></span>':''}</div>`;
    }
    h+='</div>'; return h;
  }

  updateBARangeLabel();
  const cl=document.getElementById('ba-cal-left'), cr=document.getElementById('ba-cal-right');
  if(cl) cl.innerHTML=buildBAMonth(yr,mo);
  if(cr) cr.innerHTML=buildBAMonth(yr2,mo2);
}

function renderBARangePicker(){ reBuildBAMonths(); }

// ── COST EDITOR ───────────────────────────────────────────
// Always reads from live MENU so new products appear automatically
function renderCostEditor(){
  const costs=loadCosts();
  const el=document.getElementById('ba-cost-editor');
  if(!el) return;

  const rows=costEditorRows();
  const catOrder=[...new Set([...Object.keys(CAT_LABELS),...rows.map(i=>i.cat)])];

  let html='<div class="cost-editor-grid">';
  catOrder.forEach(cat=>{
    const items=rows.filter(i=>i.cat===cat);
    if(!items.length) return;
    html+=`<div class="cost-cat-header">${getCatLabel(cat)}</div>`;
    items.forEach(item=>{
      const cost=costs[item.name]||'';
      const margin=cost&&item.price?Math.round(((item.price-parseFloat(cost))/item.price)*100):null;
      const mc=margin===null?'var(--beige-dark)':margin>=60?'var(--green)':margin>=40?'var(--orange)':'var(--red-glow)';
      html+=`<div class="cost-row">
        <span class="cost-emoji">${item.emoji}</span>
        <span class="cost-name">${escHtml(item.name)}${item.inMenu?'':' <span class="ba-off-menu">descontinuado</span>'}</span>
        <span class="cost-price">${fmtMoney(item.price)}</span>
        <input class="pixel-input cost-input" type="number" placeholder="Costo $" min="0" step="1"
          data-name="${escHtml(item.name)}" value="${escHtml(String(cost))}"/>
        <span class="cost-margin" style="color:${mc};font-family:var(--mono);font-size:12px;min-width:80px;text-align:right">
          ${margin!==null?margin+'% margen':'—'}
        </span>
      </div>`;
    });
  });
  html+='</div>';
  html+=`<button class="btn-primary" id="btn-save-costs" style="width:auto;padding:.5rem 1.5rem;margin-top:.75rem">💾 GUARDAR COSTOS</button>`;
  el.innerHTML=html;

  el.querySelectorAll('.cost-input').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const name=inp.dataset.name;
      const item=rows.find(i=>i.name===name);
      if(!item) return;
      const cost=parseFloat(inp.value);
      const margin=!isNaN(cost)&&cost>0&&item.price?Math.round(((item.price-cost)/item.price)*100):null;
      const mc=margin===null?'var(--beige-dark)':margin>=60?'var(--green)':margin>=40?'var(--orange)':'var(--red-glow)';
      const marginSpan=inp.parentElement.querySelector('.cost-margin');
      if(marginSpan){ marginSpan.style.color=mc; marginSpan.textContent=margin!==null?margin+'% margen':'—'; }
    });
  });

  document.getElementById('btn-save-costs').addEventListener('click',()=>{
    const names=[];
    const newCosts={};
    el.querySelectorAll('.cost-input').forEach(inp=>{
      names.push(inp.dataset.name);
      const v=parseFloat(inp.value);
      if(!isNaN(v)&&v>0) newCosts[inp.dataset.name]=v;
    });
    saveCosts(newCosts, names);
    persistMenuCatalog(true);
    toast('✔ Costos guardados en el Excel','success');
    renderCostEditor(); renderBA();
  });
}

// ── HOUR DRILL-DOWN MODAL ─────────────────────────────────
function openHourModal(hour, orders){
  const modal=document.getElementById('modal-hour-detail');
  if(!modal) return;
  const hourOrders=orders.filter(o=>{
    const h=parseInt(String(o['Hora']||'').split(':')[0]);
    return h===hour;
  }).sort((a,b)=>String(b['Fecha']).localeCompare(String(a['Fecha'])));

  document.getElementById('hour-modal-title').textContent=`${pad(hour)}:00 — ${hourOrders.length} órdenes`;

  // Group by weekday to show pattern
  const byDay={};
  hourOrders.forEach(o=>{
    const dt=new Date(String(o['Fecha'])+'T12:00:00');
    const dn=DIAS_SEMANA[dt.getDay()];
    byDay[dn]=(byDay[dn]||0)+1;
  });
  const dayPattern=Object.entries(byDay).map(([d,c])=>`<span class="hour-day-chip">${d}: ${c}</span>`).join('');

  const tbody=hourOrders.slice(0,50).map(o=>`
    <tr>
      <td style="font-family:var(--pixel);font-size:7px;color:var(--yellow)">#${String(o['Num_Orden']||'').padStart(4,'0')}</td>
      <td>${o['Fecha']||''}</td>
      <td>${DIAS_SEMANA[new Date(String(o['Fecha'])+'T12:00:00').getDay()]}</td>
      <td>${escHtml(o['Cliente']||'')}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${escHtml(o['Productos']||'')}</td>
      <td style="font-family:var(--mono);color:var(--green)">${fmtMoney(o['Total']||0)}</td>
      <td>${o['Metodo_Pago']||''}</td>
    </tr>`).join('');

  document.getElementById('hour-modal-body').innerHTML=`
    <div class="hour-day-pattern">${dayPattern}</div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="pixel-table">
        <thead><tr><th>#</th><th>FECHA</th><th>DÍA</th><th>CLIENTE</th><th>PRODUCTOS</th><th>TOTAL</th><th>PAGO</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  modal.classList.remove('hidden');
}

// ── MAIN RENDER ───────────────────────────────────────────
function renderBA(){
  const orders=getBAOrders();
  syncCatalogFromMenu();
  refreshCategoryLabels();
  const costs=loadCosts();

  // ── KPIs ──────────────────────────────────────────────
  const totalRevenue=orders.reduce((s,o)=>s+(parseFloat(o['Total'])||0),0);
  const totalOrders=orders.length;
  const avgTicket=totalOrders?totalRevenue/totalOrders:0;

  const itemSales={};
  orders.forEach(o=>{
    parseOrderItems(o).forEach(({name,qty})=>{
      const price=priceAt(name, o['Fecha']);
      const cost=costs[name]||0;
      if(!itemSales[name]) itemSales[name]={qty:0,revenue:0,cost:0};
      itemSales[name].qty+=qty;
      itemSales[name].revenue+=price*qty;
      itemSales[name].cost+=cost*qty;
    });
  });

  const totalCOGS=Object.values(itemSales).reduce((s,v)=>s+v.cost,0);
  const grossProfit=totalRevenue-totalCOGS;
  const grossMargin=totalRevenue>0?(grossProfit/totalRevenue)*100:0;
  const costsConfigured=Object.keys(costs).length>0;

  const smashNames=new Set(MENU.filter(i=>i.cat==='smash').map(i=>i.name));
  let totalBurgers=0;
  Object.entries(itemSales).forEach(([name,v])=>{ if(smashNames.has(name)) totalBurgers+=v.qty; });

  const profitHtml=costsConfigured
    ?`<div class="ba-kpi-card kpi-green">
        <div class="ba-kpi-label">UTILIDAD BRUTA</div>
        <div class="ba-kpi-val">${fmtMoney(grossProfit)}</div>
        <div class="ba-kpi-sub">Margen: ${grossMargin.toFixed(1)}%</div>
      </div>
      <div class="ba-kpi-card">
        <div class="ba-kpi-label">COSTO TOTAL</div>
        <div class="ba-kpi-val" style="color:var(--orange)">${fmtMoney(totalCOGS)}</div>
        <div class="ba-kpi-sub">de ingredientes</div>
      </div>`
    :`<div class="ba-kpi-card kpi-dim">
        <div class="ba-kpi-label">UTILIDAD BRUTA</div>
        <div class="ba-kpi-val" style="font-size:12px;color:var(--beige-dark)">Configura costos ↓</div>
      </div>`;

  document.getElementById('ba-kpis').innerHTML=`
    <div class="ba-kpi-card kpi-blue">
      <div class="ba-kpi-label">INGRESOS TOTALES</div>
      <div class="ba-kpi-val">${fmtMoney(totalRevenue)}</div>
      <div class="ba-kpi-sub">${totalOrders} órdenes</div>
    </div>
    <div class="ba-kpi-card">
      <div class="ba-kpi-label">TICKET PROMEDIO</div>
      <div class="ba-kpi-val">${fmtMoney(avgTicket)}</div>
      <div class="ba-kpi-sub">por orden</div>
    </div>
    <div class="ba-kpi-card">
      <div class="ba-kpi-label">HAMBURGUESAS</div>
      <div class="ba-kpi-val">${totalBurgers}</div>
      <div class="ba-kpi-sub">smash vendidas</div>
    </div>
    ${profitHtml}
    <div class="ba-kpi-card">
      <div class="ba-kpi-label">MÉTODOS DE PAGO</div>
      ${['Efectivo','Transferencia','Tarjeta'].map(m=>{
        const cnt=orders.filter(o=>o['Metodo_Pago']===m).length;
        const pct=totalOrders?Math.round(cnt/totalOrders*100):0;
        return `<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px">
          <span style="color:var(--beige-dark)">${m}</span>
          <span style="font-family:var(--mono);color:var(--yellow)">${pct}%</span>
        </div>`;
      }).join('')}
    </div>`;

  // ── TOP PRODUCTS ───────────────────────────────────────
  const sortedItems=Object.entries(itemSales).sort((a,b)=>b[1].qty-a[1].qty);
  const papaNames=new Set(MENU.filter(i=>i.cat==='especial').map(i=>i.name));
  const bebNames =new Set(MENU.filter(i=>i.cat==='bebidas').map(i=>i.name));
  const topBurgers=sortedItems.filter(([n])=>smashNames.has(n)).slice(0,7);
  const topPapas  =sortedItems.filter(([n])=>papaNames.has(n)).slice(0,5);
  const topBebidas=sortedItems.filter(([n])=>bebNames.has(n)).slice(0,5);

  function renderProductBar(name,data,maxQ){
    const item=MENU.find(i=>i.name===name);
    const pct=Math.round((data.qty/maxQ)*100);
    const margin=costs[name]&&item?Math.round(((item.price-costs[name])/item.price)*100):null;
    const mc=margin===null?'var(--beige-dark)':margin>=60?'var(--green)':margin>=40?'var(--orange)':'var(--red-glow)';
    return `<div class="ba-prod-row">
      <span class="ba-prod-emoji">${item?item.emoji:''}</span>
      <div class="ba-prod-info">
        <div class="ba-prod-name">${escHtml(name)}</div>
        <div class="ba-prod-bar-wrap"><div class="ba-prod-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="ba-prod-stats">
        <span class="ba-prod-qty">${data.qty} uds</span>
        <span class="ba-prod-rev">${fmtMoney(data.revenue)}</span>
        ${margin!==null?`<span class="ba-prod-margin" style="color:${mc}">${margin}%</span>`:''}
      </div>
    </div>`;
  }

  document.getElementById('ba-top-burgers').innerHTML=
    topBurgers.length?topBurgers.map(([n,d])=>renderProductBar(n,d,topBurgers[0][1].qty)).join(''):'<div class="empty-list">Sin datos</div>';
  document.getElementById('ba-top-papas').innerHTML=
    topPapas.length?topPapas.map(([n,d])=>renderProductBar(n,d,topPapas[0][1].qty)).join(''):'<div class="empty-list">Sin datos</div>';
  document.getElementById('ba-top-bebidas').innerHTML=
    topBebidas.length?topBebidas.map(([n,d])=>renderProductBar(n,d,topBebidas[0][1].qty)).join(''):'<div class="empty-list">Sin datos</div>';

  // ── COMBOS ─────────────────────────────────────────────
  const comboMap={};
  orders.forEach(o=>{
    const items=parseOrderItems(o);
    const burgers=items.filter(i=>smashNames.has(i.name));
    const others =items.filter(i=>!smashNames.has(i.name));
    burgers.forEach(b=>others.forEach(s=>{
      const k=`${b.name} + ${s.name}`;
      comboMap[k]=(comboMap[k]||0)+1;
    }));
  });
  const topCombos=Object.entries(comboMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const comboEl=document.getElementById('ba-combos');
  if(topCombos.length){
    const maxC=topCombos[0][1];
    comboEl.innerHTML=topCombos.map(([combo,cnt],i)=>{
      const pct=Math.round((cnt/maxC)*100);
      const medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
      return `<div class="ba-combo-row">
        <span class="ba-combo-medal">${medals[i]}</span>
        <div class="ba-combo-info">
          <div class="ba-combo-name">${escHtml(combo)}</div>
          <div class="ba-prod-bar-wrap"><div class="ba-prod-bar" style="width:${pct}%;background:var(--blue-mid)"></div></div>
        </div>
        <span class="ba-combo-cnt">${cnt}x</span>
      </div>`;
    }).join('');
  } else { comboEl.innerHTML='<div class="empty-list">Sin datos de combos</div>'; }

  // ── TOP CLIENTES — group by name only, show most-used address ──
  // Key = nombre (trimmed, case-sensitive as entered)
  // Addresses are merged; we show the most frequent one
  const clientMap={};
  orders.forEach(o=>{
    const name=(o['Cliente']||'Sin nombre').trim();
    const dir =(o['Direccion']||'').trim();
    if(!clientMap[name]) clientMap[name]={total:0,count:0,lastDate:'',addrCount:{}};
    clientMap[name].total+=parseFloat(o['Total'])||0;
    clientMap[name].count++;
    if(String(o['Fecha'])>clientMap[name].lastDate) clientMap[name].lastDate=String(o['Fecha']);
    if(dir) clientMap[name].addrCount[dir]=(clientMap[name].addrCount[dir]||0)+1;
  });
  // Pick most frequent address for display
  Object.values(clientMap).forEach(c=>{
    const entries=Object.entries(c.addrCount);
    c.direccion=entries.length?entries.sort((a,b)=>b[1]-a[1])[0][0]:'—';
  });

  const topBySpend =Object.entries(clientMap).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
  const topByVisits=Object.entries(clientMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);

  function renderClientTable(rows,valueKey){
    return `<table class="pixel-table ba-client-table">
      <thead><tr><th>#</th><th>CLIENTE</th><th>VISITAS</th><th>${valueKey==='total'?'TOTAL GASTADO':'VISITAS'}</th></tr></thead>
      <tbody>${rows.map(([name,d],i)=>{
        const medals=['🥇','🥈','🥉','🏅','🏅'];
        return `<tr>
          <td style="font-size:16px">${medals[i]}</td>
          <td><strong style="color:var(--beige);font-size:13px">${escHtml(name)}</strong></td>
          <td style="text-align:center;color:var(--yellow);font-family:var(--pixel);font-size:9px">${d.count}</td>
          <td style="font-family:var(--mono);color:var(--green);font-size:13px">${valueKey==='total'?fmtMoney(d.total):d.count}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  document.getElementById('ba-top-clients-spend').innerHTML=
    topBySpend.length?renderClientTable(topBySpend,'total'):'<div class="empty-list">Sin datos</div>';
  document.getElementById('ba-top-clients-visits').innerHTML=
    topByVisits.length?renderClientTable(topByVisits,'count'):'<div class="empty-list">Sin datos</div>';

  // ── COTOS ─────────────────────────────────────────────
  const cotoMap={};
  orders.forEach(o=>{
    const coto=extractCoto(o['Direccion']);
    if(!cotoMap[coto]) cotoMap[coto]={total:0,count:0};
    cotoMap[coto].total+=parseFloat(o['Total'])||0;
    cotoMap[coto].count++;
  });
  const topCotos=Object.entries(cotoMap).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
  const cotoEl=document.getElementById('ba-cotos');
  if(topCotos.length){
    const maxCoto=topCotos[0][1].total;
    cotoEl.innerHTML=topCotos.map(([coto,d])=>{
      const pct=Math.round((d.total/maxCoto)*100);
      return `<div class="ba-coto-row">
        <div class="ba-coto-info">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span class="ba-prod-name">${escHtml(coto)}</span>
            <span style="font-size:10px;color:var(--beige-dark)">${d.count} órdenes</span>
          </div>
          <div class="ba-prod-bar-wrap">
            <div class="ba-prod-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--blue-mid),var(--blue-light))"></div>
          </div>
        </div>
        <span class="ba-prod-rev" style="margin-left:.75rem">${fmtMoney(d.total)}</span>
      </div>`;
    }).join('');
  } else { cotoEl.innerHTML='<div class="empty-list">Sin datos</div>'; }

  // ── TICKET DISTRIBUTION ───────────────────────────────
  const buckets=[
    {label:'< $100',min:0,max:100,count:0},
    {label:'$100-$199',min:100,max:200,count:0},
    {label:'$200-$299',min:200,max:300,count:0},
    {label:'$300-$399',min:300,max:400,count:0},
    {label:'$400+',min:400,max:Infinity,count:0},
  ];
  orders.forEach(o=>{
    const t=parseFloat(o['Total'])||0;
    const b=buckets.find(b=>t>=b.min&&t<b.max);
    if(b) b.count++;
  });
  const maxBucket=Math.max(...buckets.map(b=>b.count),1);
  document.getElementById('ba-ticket-dist').innerHTML=buckets.map(b=>{
    const pct=Math.round((b.count/maxBucket)*100);
    const pctOfTotal=totalOrders?Math.round((b.count/totalOrders)*100):0;
    return `<div class="ba-dist-row">
      <span class="ba-dist-label">${b.label}</span>
      <div class="ba-prod-bar-wrap" style="flex:1">
        <div class="ba-prod-bar" style="width:${pct}%;background:var(--blue-mid)"></div>
      </div>
      <span style="font-family:var(--mono);font-size:11px;color:var(--yellow);min-width:55px;text-align:right">${b.count} (${pctOfTotal}%)</span>
    </div>`;
  }).join('');

  // ── HORA PICO — clickable ─────────────────────────────
  const hourMap=Array(24).fill(0).map((_,h)=>({h,count:0,revenue:0}));
  orders.forEach(o=>{
    const h=parseInt(String(o['Hora']||'').split(':')[0]);
    if(h>=0&&h<24){ hourMap[h].count++; hourMap[h].revenue+=parseFloat(o['Total'])||0; }
  });
  const activeHours=hourMap.filter(h=>h.count>0);
  const maxHour=Math.max(...activeHours.map(h=>h.count),1);
  const hourEl=document.getElementById('ba-hora-pico');
  hourEl.innerHTML=activeHours.map(h=>{
    const pct=Math.round((h.count/maxHour)*100);
    const isHot=h.count===maxHour;
    const color=isHot?'var(--red)':pct>=70?'var(--orange)':pct>=40?'var(--blue-mid)':'var(--border)';
    return `<div class="chart-bar-col hour-bar" data-hour="${h.h}" style="min-width:44px;cursor:pointer" title="Ver órdenes de ${pad(h.h)}:00">
      <div class="chart-bar-label-top" style="font-size:8px">${h.count}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar chart-bar-active" style="height:${pct}%;background:${color}"></div>
      </div>
      <div class="chart-bar-day" style="font-size:7px">${pad(h.h)}:00</div>
    </div>`;
  }).join('');

  // Bind hour clicks
  hourEl.querySelectorAll('.hour-bar').forEach(bar=>{
    bar.addEventListener('click',()=>openHourModal(parseInt(bar.dataset.hour), orders));
    bar.addEventListener('mouseenter',()=>bar.style.opacity='.75');
    bar.addEventListener('mouseleave',()=>bar.style.opacity='1');
  });

  // ── PROFIT TABLE ───────────────────────────────────────
  const profitEl=document.getElementById('ba-profit-table-wrap');
  if(costsConfigured){
    const profitItems=Object.entries(itemSales)
      .filter(([n])=>costs[n])
      .map(([name,d])=>{
        const item=MENU.find(i=>i.name===name);
        const price=d.qty?d.revenue/d.qty:priceAt(name,today());
        const cost=costs[name]||0;
        const margin=price>0?((price-cost)/price)*100:0;
        return {name,emoji:item?item.emoji:(loadCatalog().items[name]?.emoji||'🍽️'),qty:d.qty,revenue:d.revenue,cogs:d.cost,profit:d.revenue-d.cost,margin,price,cost,inMenu:!!item};
      })
      .sort((a,b)=>b.profit-a.profit);

    profitEl.innerHTML=profitItems.length?`
      <table class="pixel-table">
        <thead><tr>
          <th>PRODUCTO</th><th>UDS</th><th>PRECIO</th><th>COSTO</th>
          <th>MARGEN</th><th>INGRESOS</th><th>UTILIDAD</th>
        </tr></thead>
        <tbody>${profitItems.map(p=>{
          const mc=p.margin>=60?'var(--green)':p.margin>=40?'var(--orange)':'var(--red-glow)';
          return `<tr>
            <td>${p.emoji} ${escHtml(p.name)}${p.inMenu?'':' <span class="ba-off-menu">descontinuado</span>'}</td>
            <td style="text-align:center;color:var(--yellow);font-family:var(--pixel);font-size:8px">${p.qty}</td>
            <td style="font-family:var(--mono)">${fmtMoney(p.price)}</td>
            <td style="font-family:var(--mono);color:var(--orange)">${fmtMoney(p.cost)}</td>
            <td style="font-family:var(--pixel);font-size:8px;color:${mc}">${p.margin.toFixed(1)}%</td>
            <td style="font-family:var(--mono);color:var(--green)">${fmtMoney(p.revenue)}</td>
            <td style="font-family:var(--mono);color:${p.profit>=0?'var(--green)':'var(--red-glow)'}">${fmtMoney(p.profit)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`
    :'<div class="empty-list">Configura costos arriba para ver rentabilidad</div>';
  } else {
    profitEl.innerHTML='<div class="empty-list" style="padding:1rem">💡 Configura los costos de ingredientes arriba para ver el análisis de rentabilidad por producto</div>';
  }

  // ── AVG PROFIT PER ORDER ──────────────────────────────
  if(costsConfigured){
    let sumP=0,cntP=0;
    orders.forEach(o=>{
      let op=0;
      parseOrderItems(o).forEach(({name,qty})=>{
        const price=priceAt(name, o['Fecha']);
        const cost=costs[name];
        if(cost!==undefined) op+=(price-cost)*qty;
      });
      if(op!==0){sumP+=op;cntP++;}
    });
    const avgP=cntP?sumP/cntP:0;
    const el2=document.getElementById('ba-avg-profit');
    if(el2) el2.textContent=fmtMoney(avgP);
  }

  // Refresh slicers (options may have changed)
  renderBASlicers();
}

// ── INIT ──────────────────────────────────────────────────
function initBAFilters(){ /* slicers built inside renderBASlicers on renderBA call */ }

function initBATab(){
  initBARangePicker();
  initBAFilters();
  renderCostEditor();

  // Hour detail modal close
  const hModal=document.getElementById('modal-hour-detail');
  if(hModal){
    document.getElementById('btn-hour-modal-close').addEventListener('click',()=>hModal.classList.add('hidden'));
    hModal.addEventListener('click',e=>{ if(e.target===hModal) hModal.classList.add('hidden'); });
  }

  renderBA();
}

