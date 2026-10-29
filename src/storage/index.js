import { catalogCache, saveCatalog } from '../domain/catalog.js';
import { saveMenuToStorage, saveMenuOrder } from '../domain/menu.js';
import { state } from '../state.js';
import { writeMenuCatalogSheets, persistWorkbook } from './excel.js';
import { toast } from '../ui/toast.js';

export let persistMenuTimer=null;

export async function persistMenuCatalog(immediate){
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
