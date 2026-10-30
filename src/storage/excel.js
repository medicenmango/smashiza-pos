import { itemsFromLegacy, orderItems } from '../domain/orders.js';
import { state } from '../state.js';
import { emitDataLoaded } from './events.js';
import { menuCatalogRows, applyMenuFromRows, applyCatalogFromRows } from './rows.js';
import { toast } from '../ui/toast.js';
import { toYmd, toHms, fmtDate } from '../utils/format.js';

export const HEADERS = [
  'Num_Orden','Fecha','Hora','Cliente','Direccion',
  'Productos','Cantidades','Comentarios','Metodo_Pago',
  'Ajuste','Total','Recibido','Cambio','Estado'
];

export const DET_SHEET='OrdenDetalle';

export const DET_HEADERS=['Num_Orden','Linea','Producto_Id','Producto','Cantidad','Precio_Unitario','Subtotal'];

export const INV_SHEET='Inventario', REC_SHEET='Recetas', MOV_SHEET='Movimientos';

export const INV_HEADERS=['Nombre','Unidad','Stock','Minimo','Ideal','Proveedor','Nota'];

export const REC_HEADERS=['Producto','Ingrediente','Cantidad','Unidad'];

export const MOV_HEADERS=['Fecha','Hora','Tipo','Ingrediente','Cantidad','Unidad','Num_Orden','Nota'];

export const MENU_SHEET='Menu', CAT_SHEET='Categorias', COST_SHEET='Costos', CATALOG_SHEET='Catalogo', PRICE_SHEET='PrecioHistorial';

export const MENU_HEADERS=['Id','Categoria','Emoji','Nombre','Precio','Orden'];

export const CAT_HEADERS=['Id','Etiqueta'];

export const COST_HEADERS=['Producto','Costo'];

export const CATALOG_HEADERS=['Producto','Emoji','Categoria','EnMenu'];

export const PRICE_HEADERS=['Producto','Desde','Precio'];

export const EXCEL_PICKER_OPTS = {
  id: 'smashiza-ordenes',
  types: [{
    description: 'Excel',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
  }],
  excludeAcceptAllOption: false,
  multiple: false,
};

export function canWriteHandle(h){
  return !!(h && typeof h.createWritable === 'function');
}

export async function ensureWriteAccess(h){
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

export async function pickFile() {
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

export async function handleFromDrop(dt){
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

export async function readFileHandle(h){
  const f=await h.getFile();
  return new Promise((res,rej)=>{ const fr=new FileReader();
    fr.onload=e=>res(e.target.result); fr.onerror=rej; fr.readAsArrayBuffer(f); });
}

export function pickFileClassic(){
  return new Promise(res=>{
    const i=document.createElement('input'); i.type='file'; i.accept='.xlsx,.xls';
    i.onchange=()=>{ const f=i.files[0]; if(!f) return res(null);
      res({_file:f,name:f.name,getFile:async()=>f,createWritable:null}); };
    i.click();
  });
}

export async function saveWorkbook(){
  if(state.demoMode) return;
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

export function ensureSheet(wb){
  [[state.sheetName,HEADERS],[DET_SHEET,DET_HEADERS]].forEach(([name,headers])=>{
    if(!wb.SheetNames.includes(name))
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),name);
  });
}

function attachOrderItems(wb){
  const byOrder=new Map();
  parseNamedSheet(wb, DET_SHEET, DET_HEADERS).forEach(r=>{
    const k=String(parseInt(r.Num_Orden));
    if(!byOrder.has(k)) byOrder.set(k, []);
    byOrder.get(k).push(r);
  });
  state.allOrders.forEach(o=>{
    const rows=byOrder.get(String(parseInt(o['Num_Orden'])));
    o['Items']=rows
      ? rows.sort((a,b)=>(parseInt(a.Linea)||0)-(parseInt(b.Linea)||0)).map(r=>({
          Producto_Id:String(r.Producto_Id||''),
          Producto:String(r.Producto),
          Cantidad:parseInt(r.Cantidad)||1,
          Precio_Unitario:Number(r.Precio_Unitario)||0,
        }))
      : itemsFromLegacy(o);
  });
}

function writeDetailSheet(){
  ensureSheet(state.workbook);
  const rows=[];
  state.allOrders.forEach(o=>orderItems(o).forEach((i,idx)=>rows.push({
    Num_Orden:o['Num_Orden'], Linea:idx+1, Producto_Id:i.Producto_Id, Producto:i.Producto,
    Cantidad:i.Cantidad, Precio_Unitario:i.Precio_Unitario, Subtotal:i.Cantidad*i.Precio_Unitario,
  })));
  state.workbook.Sheets[DET_SHEET]=rowsToSheet(DET_HEADERS, rows);
}

export function ensureInvSheets(wb){
  [[INV_SHEET,INV_HEADERS],[REC_SHEET,REC_HEADERS],[MOV_SHEET,MOV_HEADERS]].forEach(([name,headers])=>{
    if(!wb.SheetNames.includes(name))
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),name);
  });
}

export function ensureMenuSheets(wb){
  [[MENU_SHEET,MENU_HEADERS],[CAT_SHEET,CAT_HEADERS],[COST_SHEET,COST_HEADERS],[CATALOG_SHEET,CATALOG_HEADERS],[PRICE_SHEET,PRICE_HEADERS]].forEach(([name,headers])=>{
    if(!wb.SheetNames.includes(name))
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),name);
  });
}

export function rowsToSheet(headers, rows){
  return XLSX.utils.aoa_to_sheet([headers, ...rows.map(r=>headers.map(h=>r[h]??''))]);
}

export function parseNamedSheet(wb, name, headers){
  const ws=wb.Sheets[name]; if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws,{defval:''})
    .map(row=>{ const o={}; headers.forEach(h=>o[h]=row[h]??''); return o; })
    .filter(r=>String(r[headers[0]]??'').trim());
}

export function writeInvSheets(){
  if(!state.workbook) return;
  ensureInvSheets(state.workbook);
  state.workbook.Sheets[INV_SHEET]=rowsToSheet(INV_HEADERS, state.inventory);
  state.workbook.Sheets[REC_SHEET]=rowsToSheet(REC_HEADERS, state.recipes);
  state.workbook.Sheets[MOV_SHEET]=rowsToSheet(MOV_HEADERS, state.movements);
}

export function writeMenuCatalogSheets(){
  if(!state.workbook) return;
  ensureMenuSheets(state.workbook);
  const { menuRows, catRows, costRows, catalogRows, priceRows }=menuCatalogRows();
  state.workbook.Sheets[MENU_SHEET]=rowsToSheet(MENU_HEADERS, menuRows);
  state.workbook.Sheets[CAT_SHEET]=rowsToSheet(CAT_HEADERS, catRows);
  state.workbook.Sheets[COST_SHEET]=rowsToSheet(COST_HEADERS, costRows);
  state.workbook.Sheets[CATALOG_SHEET]=rowsToSheet(CATALOG_HEADERS, catalogRows);
  state.workbook.Sheets[PRICE_SHEET]=rowsToSheet(PRICE_HEADERS, priceRows);
}

export function hydrateMenuCatalogFromWorkbook(wb){
  ensureMenuSheets(wb);
  const menuRows=parseNamedSheet(wb, MENU_SHEET, MENU_HEADERS);
  const catRows=parseNamedSheet(wb, CAT_SHEET, CAT_HEADERS);
  const costRows=parseNamedSheet(wb, COST_SHEET, COST_HEADERS);
  const itemRows=parseNamedSheet(wb, CATALOG_SHEET, CATALOG_HEADERS);
  const histRows=parseNamedSheet(wb, PRICE_SHEET, PRICE_HEADERS);
  let needSave=false;
  if(menuRows.length) applyMenuFromRows(menuRows, catRows);
  else needSave=true;
  if(costRows.length||itemRows.length||histRows.length) applyCatalogFromRows(costRows, itemRows, histRows);
  else needSave=true;
  return needSave;
}

export function parseOrders(wb){
  const ws=wb.Sheets[state.sheetName]; if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws,{defval:''}).map(o=>{
    const ymd=toYmd(o['Fecha']); if(ymd) o['Fecha']=ymd;
    const hms=toHms(o['Hora']); if(hms) o['Hora']=hms;
    return o;
  });
}

function writeAllSheets(){
  const rows=[HEADERS,...state.allOrders.map(o=>HEADERS.map(h=>o[h]??''))];
  state.workbook.Sheets[state.sheetName]=XLSX.utils.aoa_to_sheet(rows);
  writeDetailSheet();
  writeInvSheets();
  writeMenuCatalogSheets();
}

export async function persistWorkbook(){
  writeAllSheets();
  await saveWorkbook();
}

export function downloadBackup(){
  const prev=state.workbook;
  state.workbook=XLSX.utils.book_new();
  try{
    ensureSheet(state.workbook);
    writeAllSheets();
    const arr=XLSX.write(state.workbook,{bookType:'xlsx',type:'array'});
    const url=URL.createObjectURL(new Blob([arr],{type:'application/octet-stream'}));
    const a=document.createElement('a'); a.href=url; a.download=`LaSmashiza_Respaldo_${fmtDate()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  } finally { state.workbook=prev; }
}

// Loads a workbook into memory without keeping a file handle or writing back to it.
export async function loadWorkbookForImport(handle){
  const ab=await readFileHandle(handle);
  const wb=XLSX.read(ab,{type:'array',cellDates:true});
  await applyWorkbook(wb,{ importOnly:true, fileName:handle.name||handle._file?.name||'archivo.xlsx' });
}

export async function applyWorkbook(wb, opts={}){
  ensureSheet(wb);
  ensureInvSheets(wb);
  ensureMenuSheets(wb);
  state.workbook=wb;
  state.demoMode=!!opts.demo;
  if(opts.importOnly) state.fileHandle=null;
  else if(opts.handle) state.fileHandle=opts.handle;
  else if(opts.demo){
    state.fileHandle={
      name: opts.fileName||'MODO PRUEBA',
      createWritable: async()=>({ write:async()=>{}, close:async()=>{} })
    };
  }
  state.fileName=opts.fileName||state.fileHandle?.name||state.fileHandle?._file?.name||'archivo.xlsx';
  state.allOrders=parseOrders(wb);
  state.inventory=parseNamedSheet(wb, INV_SHEET, INV_HEADERS);
  state.recipes=parseNamedSheet(wb, REC_SHEET, REC_HEADERS);
  state.movements=parseNamedSheet(wb, MOV_SHEET, MOV_HEADERS);
  state._hydrating=true;
  const migrated=hydrateMenuCatalogFromWorkbook(wb);
  state._hydrating=false;
  attachOrderItems(wb);
  if(migrated && !state.demoMode && !opts.importOnly){
    writeMenuCatalogSheets();
    try{
      await saveWorkbook();
      toast('✔ Menú y costos del navegador se copiaron al Excel. Si Safari descargó copia, reemplaza el original.','success',7000);
    }catch(e){ toast('Menú listo en memoria, pero no se pudo escribir el Excel: '+e.message,'error',6000); }
  }
  emitDataLoaded();
}

export async function loadExcel(handle){
  const ab=await readFileHandle(handle);
  const wb=XLSX.read(ab,{type:'array',cellDates:true});
  await applyWorkbook(wb,{
    handle,
    fileName:handle.name||handle._file?.name||'archivo.xlsx'
  });
}

export async function loadDemoWorkbook(){
  if(typeof buildSmashizaDemo!=='function') throw new Error('Faltan los datos de prueba');
  const demo=buildSmashizaDemo();
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, rowsToSheet(HEADERS, demo.orders), 'Ordenes');
  XLSX.utils.book_append_sheet(wb, rowsToSheet(INV_HEADERS, demo.inventory), INV_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(REC_HEADERS, demo.recipes), REC_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(MOV_HEADERS, demo.movements), MOV_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(MENU_HEADERS, demo.menu), MENU_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(CAT_HEADERS, demo.cats), CAT_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(COST_HEADERS, demo.costs), COST_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(CATALOG_HEADERS, demo.catalog), CATALOG_SHEET);
  XLSX.utils.book_append_sheet(wb, rowsToSheet(PRICE_HEADERS, demo.priceHist), PRICE_SHEET);
  await applyWorkbook(wb,{ demo:true, fileName:'MODO PRUEBA (no guarda)' });
}

export async function createNewExcel(){
  const wb=XLSX.utils.book_new();
  ensureSheet(wb);
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
      return true;
    }catch(e){ if(e.name==='AbortError') return false; }
  }
  const url=URL.createObjectURL(new Blob([arr],{type:'application/octet-stream'}));
  const a=document.createElement('a'); a.href=url; a.download='LaSmashiza_Ordenes.xlsx'; a.click();
  URL.revokeObjectURL(url); toast('📥 Excel descargado. Selecciónalo arriba.','info',5000);
  return false;
}

export const excelBackend = {
  isReady: ()=>!!state.workbook,
  canReload: ()=>!!state.fileHandle,
  reload: ()=>loadExcel(state.fileHandle),
  saveNewOrder: ()=>persistWorkbook(),
  saveOrder: ()=>persistWorkbook(),
  deleteOrder: ()=>persistWorkbook(),
  saveInventory: ()=>persistWorkbook(),
  saveMenuCatalog: ()=>persistWorkbook(),
};

export function downloadInvTemplate(){
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
