import { catalogCache, saveCatalog } from '../domain/catalog.js';
import { saveMenuToStorage, saveMenuOrder } from '../domain/menu.js';
import { state } from '../state.js';
import { excelBackend, downloadInvTemplate } from './excel.js';
import { toast } from '../ui/toast.js';

export { onDataLoaded } from './events.js';
export { downloadInvTemplate };

// Single entry point for features. A backend implements:
// isReady, canReload, reload, saveNewOrder, saveOrder, deleteOrder, saveInventory, saveMenuCatalog.
const backend = excelBackend;

let saveMenuTimer = null;

export function isReady(){ return backend.isReady(); }
export function canReload(){ return backend.canReload(); }
export function reload(){ return backend.reload(); }

export function saveNewOrder(order){ return backend.saveNewOrder(order); }
export function saveOrder(order){ return backend.saveOrder(order); }
export function deleteOrder(numOrden){ return backend.deleteOrder(numOrden); }
export function saveInventory(){ return backend.saveInventory(); }

export async function saveMenuCatalog(immediate){
  saveMenuToStorage();
  saveMenuOrder();
  if(catalogCache) saveCatalog(catalogCache);
  if(!isReady() || state._hydrating) return;
  const run=()=>backend.saveMenuCatalog().catch(e=>toast('Error al guardar menú/costos: '+e.message,'error'));
  clearTimeout(saveMenuTimer);
  if(immediate){ await run(); return; }
  saveMenuTimer=setTimeout(run, 500);
}
