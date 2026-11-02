import { state } from '../state.js';

/** Dueño del negocio activo (nube). En Excel/demo no hay roles → acceso total. */
export function isOwner(){
  if(!state.cloud) return true;
  return state.businessRole==='owner';
}

/** Miembro con rol cajero del negocio activo. */
export function isCashier(){
  return state.cloud && state.businessRole==='cashier';
}

/** Puede editar menú, costos, inventario (alta), branding, equipo. */
export function canManageBusiness(){
  return isOwner();
}

/** Pestañas solo para dueño. */
export const OWNER_ONLY_TABS=new Set([
  'tab-menu',
  'tab-inventario',
  'tab-analisis',
]);

export function isOwnerOnlyTab(tabId){
  return OWNER_ONLY_TABS.has(tabId);
}
