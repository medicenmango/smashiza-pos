import { SUPABASE_URL } from '../config.js';
import { SMASHIZA_BUSINESS_ID } from '../constants.js';
import { state } from '../state.js';

export const POWERED_BY_SMASHIZA = 'powered by Smashiza';

/** Presets nombrados para la pestaña NEGOCIO */
export const THEME_PRESETS = {
  retro: {
    id:'retro',
    label:'Retro Smashiza',
    primary:'#e63232',
    secondary:'#1a3bcc',
    bg:'#0d0820',
    beige:'#f5e6c8',
  },
  pastel: {
    id:'pastel',
    label:'Rosa / azul pastel',
    primary:'#e8a0bf',
    secondary:'#9bb8e8',
    bg:'#1a1528',
    beige:'#f7eef3',
  },
  neutral: {
    id:'neutral',
    label:'Neutro',
    primary:'#8b9bb4',
    secondary:'#5b7cfa',
    bg:'#10141c',
    beige:'#e8eaef',
  },
};

export const DEFAULT_THEME = THEME_PRESETS.retro;

export function normalizeHex(v, fallback){
  const s=String(v||'').trim().toLowerCase();
  if(/^#[0-9a-f]{6}$/.test(s)) return s;
  if(/^#[0-9a-f]{3}$/.test(s)){
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return fallback||DEFAULT_THEME.primary;
}

function hexToRgb(hex){
  const h=normalizeHex(hex, '#000000').slice(1);
  return {
    r:parseInt(h.slice(0,2),16),
    g:parseInt(h.slice(2,4),16),
    b:parseInt(h.slice(4,6),16),
  };
}

function rgbToHex(r,g,b){
  const c=n=>Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2,'0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(hex, toward, t){
  const a=hexToRgb(hex);
  const b=hexToRgb(toward);
  return rgbToHex(
    a.r+(b.r-a.r)*t,
    a.g+(b.g-a.g)*t,
    a.b+(b.b-a.b)*t,
  );
}

function darken(hex, t){ return mix(hex, '#000000', t); }
function lighten(hex, t){ return mix(hex, '#ffffff', t); }

export function activeTheme(){
  if(state.cloud && state.businessId){
    return {
      primary:normalizeHex(state.colorPrimary, DEFAULT_THEME.primary),
      secondary:normalizeHex(state.colorSecondary, DEFAULT_THEME.secondary),
      bg:normalizeHex(state.colorBg, DEFAULT_THEME.bg),
    };
  }
  return {
    primary:DEFAULT_THEME.primary,
    secondary:DEFAULT_THEME.secondary,
    bg:DEFAULT_THEME.bg,
  };
}

/** Aplica primary / secondary / bg a las CSS variables del shell. */
export function applyThemeColors(theme){
  const t=theme||activeTheme();
  const primary=normalizeHex(t.primary, DEFAULT_THEME.primary);
  const secondary=normalizeHex(t.secondary, DEFAULT_THEME.secondary);
  const bg=normalizeHex(t.bg, DEFAULT_THEME.bg);
  const beige=
    primary===DEFAULT_THEME.primary && secondary===DEFAULT_THEME.secondary && bg===DEFAULT_THEME.bg
      ? DEFAULT_THEME.beige
      : lighten(mix(bg, primary, 0.15), 0.82);

  const root=document.documentElement;
  const set=(k,v)=>root.style.setProperty(k, v);

  set('--red', primary);
  set('--red-dark', darken(primary, 0.28));
  set('--red-glow', lighten(primary, 0.18));
  set('--blue', secondary);
  set('--blue-mid', lighten(secondary, 0.12));
  set('--blue-light', lighten(secondary, 0.28));
  set('--beige', beige);
  set('--beige-dark', darken(beige, 0.22));
  set('--beige-mid', darken(beige, 0.08));
  set('--bg-dark', bg);
  set('--bg-mid', lighten(bg, 0.06));
  set('--bg-card', lighten(bg, 0.04));
  set('--bg-card2', lighten(bg, 0.1));
  set('--border', lighten(bg, 0.14));

  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', bg);
  if(document.body) document.body.style.background=bg;
}

/** Marca del negocio activo (nube) o defaults Smashiza (Excel/demo). */
export function activeBranding(){
  const theme=activeTheme();
  const beige=
    theme.primary===DEFAULT_THEME.primary && theme.secondary===DEFAULT_THEME.secondary && theme.bg===DEFAULT_THEME.bg
      ? DEFAULT_THEME.beige
      : undefined;
  if(state.cloud && state.businessId){
    const isSmashiza=state.businessId===SMASHIZA_BUSINESS_ID;
    // Tenant ajeno: nunca inventar "LA SMASHIZA". Smashiza: defaults de seed si faltan campos.
    const rawName=(state.ticketName||state.businessName||'').trim();
    const name=rawName || (isSmashiza ? 'LA SMASHIZA' : 'Mi negocio');
    const tagline=(state.ticketTagline||'').trim() || (isSmashiza && !rawName ? 'RETRO BURGER' : '');
    return {
      businessId:state.businessId,
      name,
      tagline,
      phone:(state.phone||'').trim(),
      footer:(state.ticketFooter||'').trim()||'Confirma tu pedido por WhatsApp',
      logoPath:(state.logoPath||'').trim(),
      logoUrl:logoPublicUrl(state.logoPath),
      poweredBy:POWERED_BY_SMASHIZA,
      isSmashiza,
      ...theme,
      beige:beige||DEFAULT_THEME.beige,
    };
  }
  // Excel / demo local: sigue siendo Smashiza.
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
    ...theme,
    beige:DEFAULT_THEME.beige,
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
  applyThemeColors(b);
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
