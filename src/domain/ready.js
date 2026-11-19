import { isOwner } from '../auth/roles.js';
import { SMASHIZA_BUSINESS_ID } from '../constants.js';
import { MENU } from './menu.js';
import { state } from '../state.js';

/**
 * Checklist de apertura de turno (avisos, no bloquea ventas).
 * @param {{ openShift?: object|null, membersCount?: number|null }} opts
 */
export function buildReadyChecklist(opts={}){
  const openShift=opts.openShift;
  const membersCount=opts.membersCount;
  const hasProduct=MENU.length>0;
  const brandName=(state.ticketName||state.businessName||'').trim();
  const hasBrandName=!!brandName;
  const hasPhone=!!(state.phone||'').trim();
  const shiftOpen=!!openShift?.openedAt;
  const cashierKnown=membersCount!=null;
  const hasCashier=cashierKnown
    ? (membersCount>=2 || state.businessRole==='cashier')
    : null;

  const items=[
    {
      id:'menu',
      ok:hasProduct,
      required:true,
      label:hasProduct
        ? 'Menú con al menos un producto'
        : 'Falta: al menos un producto en MENÚ',
      hint:'Ve a MENÚ y crea un producto.',
    },
    {
      id:'brand',
      ok:hasBrandName,
      required:true,
      label:hasBrandName
        ? `Nombre comercial: ${brandName}`
        : 'Falta: nombre comercial del ticket (NEGOCIO)',
      hint:'NEGOCIO → nombre del ticket.',
    },
    {
      id:'phone',
      ok:hasPhone,
      required:false,
      label:hasPhone
        ? `Teléfono en ticket: ${String(state.phone).trim()}`
        : 'Opcional: teléfono en NEGOCIO (sale en el recibo)',
      hint:'NEGOCIO → teléfono.',
    },
    {
      id:'cashier',
      ok:hasCashier===null?true:!!hasCashier,
      required:false,
      label:hasCashier
        ? 'Equipo: hay cajero (o operas como cajero)'
        : 'Opcional: crea un cajero en NEGOCIO → EQUIPO',
      hint:'NEGOCIO → EQUIPO → crear cajero.',
    },
    {
      id:'shift',
      ok:shiftOpen,
      required:true,
      label:shiftOpen
        ? 'Turno de caja abierto'
        : 'Falta: abrir turno en CAJA (fondo inicial)',
      hint:'CAJA → ABRIR TURNO.',
    },
  ];

  const missingRequired=items.filter(i=>i.required && !i.ok);
  const missingOptional=items.filter(i=>!i.required && !i.ok);
  const allRequiredOk=!missingRequired.length;
  const isSmashiza=state.businessId===SMASHIZA_BUSINESS_ID;

  return {
    items,
    missingRequired,
    missingOptional,
    allRequiredOk,
    isSmashiza,
    ownerOnlyBanner:isOwner(),
    /** Nunca bloquea el POS; Smashiza u otro local pueden vender igual. */
    blocksSales:false,
  };
}

export function readyBannerMessage(check){
  if(!check || check.allRequiredOk) return null;
  const bits=check.missingRequired.map(i=>{
    if(i.id==='menu') return 'menú';
    if(i.id==='brand') return 'nombre del ticket';
    if(i.id==='shift') return 'turno de caja';
    return i.id;
  });
  const prefix=check.isSmashiza
    ? 'Aviso (no bloquea La Smashiza)'
    : 'Antes de vender (solo aviso)';
  return `${prefix}: falta ${bits.join(', ')}.`;
}
