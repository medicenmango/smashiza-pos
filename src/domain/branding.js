import { SUPABASE_URL } from '../config.js';
import { SMASHIZA_BUSINESS_ID } from '../constants.js';
import { state } from '../state.js';

export const POWERED_BY_SMASHIZA = 'powered by Smashiza';

/** Marca del negocio activo (nube) o defaults Smashiza (Excel/demo). */
export function activeBranding(){
  if(state.cloud && state.businessId){
    const name=(state.ticketName||state.businessName||'Mi negocio').trim()||'Mi negocio';
    return {
      businessId:state.businessId,
      name,
      tagline:(state.ticketTagline||'').trim(),
      phone:(state.phone||'').trim(),
      footer:(state.ticketFooter||'').trim()||'Confirma tu pedido por WhatsApp',
      logoPath:(state.logoPath||'').trim(),
      logoUrl:logoPublicUrl(state.logoPath),
      poweredBy:POWERED_BY_SMASHIZA,
      isSmashiza:state.businessId===SMASHIZA_BUSINESS_ID,
    };
  }
  return {
    businessId:null,
    name:'LA SMASHIZA',
    tagline:'RETRO BURGER',
    phone:'',
    footer:'Confirma tu pedido por WhatsApp',
    logoPath:'',
    logoUrl:'',
    poweredBy:POWERED_BY_SMASHIZA,
    isSmashiza:true,
  };
}

export function logoPublicUrl(path){
  const p=String(path||'').trim().replace(/^\/+/, '');
  if(!p) return '';
  if(/^https?:\/\//i.test(p)) return p;
  return `${SUPABASE_URL}/storage/v1/object/public/business-logos/${p}`;
}

export function applyChromeBranding(){
  const b=activeBranding();
  const brand=document.getElementById('topbar-brand-text');
  if(brand) brand.textContent=`★ ${b.name.toUpperCase()}`;
  const logoImg=document.getElementById('topbar-logo');
  if(logoImg){
    if(b.logoUrl){
      logoImg.src=b.logoUrl;
      logoImg.alt=b.name;
      logoImg.classList.remove('hidden');
    } else {
      logoImg.removeAttribute('src');
      logoImg.classList.add('hidden');
    }
  }
  const title=document.querySelector('title');
  if(title && state.cloud) title.textContent=`${b.name} — POS`;
}
