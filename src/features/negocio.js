import {
  applyChromeBranding, activeBranding, applyThemeColors, THEME_PRESETS, normalizeHex,
} from '../domain/branding.js';
import { SMASHIZA_BUSINESS_ID } from '../constants.js';
import { state } from '../state.js';
import {
  updateMyBusinessBranding, uploadBusinessLogo, clearBusinessLogo, createMyBusiness,
  switchActiveBusiness, resolveActiveBusiness, syncStatus, updateMyBusinessTheme,
  deleteMyBusiness,
} from '../storage/supabase.js';
import { toast } from '../ui/toast.js';
import { escHtml } from '../utils/format.js';

function isOwner(){
  return state.cloud && state.businessRole==='owner';
}

function readThemeFromPickers(){
  return {
    primary:normalizeHex(document.getElementById('biz-color-primary')?.value, '#e63232'),
    secondary:normalizeHex(document.getElementById('biz-color-secondary')?.value, '#1a3bcc'),
    bg:normalizeHex(document.getElementById('biz-color-bg')?.value, '#0d0820'),
  };
}

function fillThemePickers(theme){
  const t=theme||activeBranding();
  const p=document.getElementById('biz-color-primary');
  const s=document.getElementById('biz-color-secondary');
  const bg=document.getElementById('biz-color-bg');
  if(p) p.value=normalizeHex(t.primary||state.colorPrimary, '#e63232');
  if(s) s.value=normalizeHex(t.secondary||state.colorSecondary, '#1a3bcc');
  if(bg) bg.value=normalizeHex(t.bg||state.colorBg, '#0d0820');
  const block=document.getElementById('biz-theme-block');
  if(block){
    block.querySelectorAll('input,button').forEach(el=>{
      el.disabled=!isOwner();
    });
  }
}

function fillSwitcher(){
  const sel=document.getElementById('biz-switcher');
  const wrap=document.getElementById('biz-switcher-wrap');
  if(!sel||!wrap) return;
  const list=state.businesses||[];
  wrap.classList.toggle('hidden', list.length<1);
  sel.innerHTML=list.map(b=>{
    const label=escHtml(b.ticketName||b.name||b.id);
    const role=b.role?` (${escHtml(b.role)})`:'';
    const active=b.id===state.businessId?' — activo':'';
    return `<option value="${escHtml(b.id)}" ${b.id===state.businessId?'selected':''}>${label}${role}${active}</option>`;
  }).join('');
}

function fillForm(){
  const b=activeBranding();
  const name=document.getElementById('biz-ticket-name');
  const tag=document.getElementById('biz-ticket-tagline');
  const phone=document.getElementById('biz-phone');
  const foot=document.getElementById('biz-ticket-footer');
  if(name) name.value=b.name||'';
  if(tag) tag.value=b.tagline||'';
  if(phone) phone.value=b.phone||'';
  if(foot) foot.value=b.footer||'';
  const prev=document.getElementById('biz-logo-preview');
  if(prev){
    if(b.logoUrl){
      prev.src=b.logoUrl;
      prev.classList.remove('hidden');
    } else {
      prev.removeAttribute('src');
      prev.classList.add('hidden');
    }
  }
  const ro=document.getElementById('biz-readonly-hint');
  const form=document.getElementById('biz-branding-form');
  if(ro) ro.classList.toggle('hidden', isOwner());
  if(form){
    form.querySelectorAll('input,textarea,button').forEach(el=>{
      if(el.id==='biz-refresh-brand') return;
      el.disabled=!isOwner() && el.type!=='button';
    });
  }
  const createWrap=document.getElementById('biz-create-extra');
  if(createWrap) createWrap.classList.toggle('hidden', !isOwner());
  const delBlock=document.getElementById('biz-delete-block');
  const canDelete=isOwner() && state.businessId && state.businessId!==SMASHIZA_BUSINESS_ID;
  if(delBlock){
    delBlock.classList.toggle('hidden', !canDelete);
    const hint=document.getElementById('biz-delete-hint');
    const expected=state.ticketName||state.businessName||'';
    if(hint) hint.innerHTML=canDelete
      ? `Para confirmar, escribe exactamente: <strong>${escHtml(expected)}</strong>`
      : '';
    const conf=document.getElementById('biz-delete-confirm');
    if(conf) conf.value='';
  }
  fillThemePickers(b);
  fillSwitcher();
}

export function renderNegocioTab(){
  const root=document.getElementById('tab-negocio');
  if(!root) return;
  if(!state.cloud){
    root.querySelector('.biz-cloud-only')?.classList.remove('hidden');
    root.querySelector('.biz-editor')?.classList.add('hidden');
    return;
  }
  root.querySelector('.biz-cloud-only')?.classList.add('hidden');
  root.querySelector('.biz-editor')?.classList.remove('hidden');
  const meta=document.getElementById('biz-active-meta');
  if(meta){
    meta.innerHTML=`Negocio activo: <strong>${escHtml(state.businessName||'—')}</strong>
      · rol: <strong>${escHtml(state.businessRole||'—')}</strong>`;
  }
  fillForm();
  applyChromeBranding();
  resolveActiveBusiness().then(()=>{
    if(meta){
      meta.innerHTML=`Negocio activo: <strong>${escHtml(state.businessName||'—')}</strong>
        · rol: <strong>${escHtml(state.businessRole||'—')}</strong>`;
    }
    fillSwitcher();
    fillThemePickers();
    applyChromeBranding();
  }).catch(()=>{});
}

export function initNegocioTab(){
  const form=document.getElementById('biz-branding-form');
  if(!form) return;

  document.getElementById('biz-switcher')?.addEventListener('change',e=>{
    const id=e.target.value;
    if(!id||id===state.businessId) return;
    const { pending }=syncStatus();
    if(pending){
      const ok=confirm(`Hay ${pending} cambio(s) sin subir. Si cambias de negocio ahora pueden perderse en este dispositivo.\n\n¿Cambiar de todos modos?`);
      if(!ok){
        e.target.value=state.businessId||'';
        return;
      }
    }
    try{
      if(!switchActiveBusiness(id)){
        e.target.value=state.businessId||'';
        return;
      }
      toast('Cambiando de negocio…','info');
      location.reload();
    }catch(err){
      e.target.value=state.businessId||'';
      toast('Error: '+err.message,'error');
    }
  });

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!isOwner()){ toast('Solo el dueño puede editar la marca.','error'); return; }
    const btn=document.getElementById('biz-save-brand');
    if(btn) btn.disabled=true;
    try{
      await updateMyBusinessBranding({
        ticketName:document.getElementById('biz-ticket-name').value.trim(),
        ticketTagline:document.getElementById('biz-ticket-tagline').value.trim(),
        phone:document.getElementById('biz-phone').value.trim(),
        ticketFooter:document.getElementById('biz-ticket-footer').value.trim(),
      });
      applyChromeBranding();
      fillForm();
      toast('✔ Marca del ticket guardada.','success');
    }catch(err){
      toast('Error: '+err.message,'error');
    }finally{
      if(btn) btn.disabled=false;
    }
  });

  document.getElementById('biz-logo-file')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file) return;
    if(!isOwner()){ toast('Solo el dueño puede subir logo.','error'); return; }
    try{
      await uploadBusinessLogo(file);
      applyChromeBranding();
      fillForm();
      toast('✔ Logo actualizado.','success');
    }catch(err){
      toast('Error al subir logo: '+err.message,'error');
    }
  });

  document.getElementById('biz-logo-clear')?.addEventListener('click',async()=>{
    if(!isOwner()) return;
    if(!state.logoPath){ toast('No hay logo.','info'); return; }
    if(!confirm('¿Quitar el logo del ticket?')) return;
    try{
      await clearBusinessLogo();
      applyChromeBranding();
      fillForm();
      toast('Logo quitado.','success');
    }catch(err){
      toast('Error: '+err.message,'error');
    }
  });

  document.querySelectorAll('.biz-preset-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!isOwner()){ toast('Solo el dueño puede editar colores.','error'); return; }
      const preset=THEME_PRESETS[btn.dataset.preset];
      if(!preset) return;
      fillThemePickers(preset);
      applyThemeColors(preset);
      toast(`Preset “${preset.label}” aplicado (guarda para persistir).`,'info');
    });
  });

  ['biz-color-primary','biz-color-secondary','biz-color-bg'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',()=>{
      if(!isOwner()) return;
      applyThemeColors(readThemeFromPickers());
    });
  });

  document.getElementById('biz-save-theme')?.addEventListener('click',async()=>{
    if(!isOwner()){ toast('Solo el dueño puede editar colores.','error'); return; }
    const btn=document.getElementById('biz-save-theme');
    const t=readThemeFromPickers();
    if(btn) btn.disabled=true;
    try{
      await updateMyBusinessTheme({
        colorPrimary:t.primary,
        colorSecondary:t.secondary,
        colorBg:t.bg,
      });
      applyChromeBranding();
      fillThemePickers();
      toast('✔ Colores guardados en este negocio.','success');
    }catch(err){
      toast('Error: '+err.message,'error');
    }finally{
      if(btn) btn.disabled=false;
    }
  });

  document.getElementById('biz-create-extra-btn')?.addEventListener('click',async()=>{
    if(!isOwner()) return;
    const name=prompt('Nombre del nuevo negocio:');
    if(name==null) return;
    const trimmed=name.trim();
    if(!trimmed){ toast('Escribe un nombre.','error'); return; }
    try{
      await createMyBusiness({ name:trimmed, ticketName:trimmed });
      toast('✔ Negocio creado. Recargando…','success');
      location.reload();
    }catch(err){
      toast('Error: '+err.message,'error');
    }
  });

  document.getElementById('biz-delete-btn')?.addEventListener('click',async()=>{
    if(!isOwner()) return;
    if(!state.businessId || state.businessId===SMASHIZA_BUSINESS_ID){
      toast('No se puede borrar La Smashiza.','error');
      return;
    }
    const expected=(state.ticketName||state.businessName||'').trim();
    const typed=(document.getElementById('biz-delete-confirm')?.value||'').trim();
    if(!typed){
      toast('Escribe el nombre del negocio para confirmar.','error');
      document.getElementById('biz-delete-confirm')?.focus();
      return;
    }
    if(typed.toLowerCase()!==expected.toLowerCase()){
      toast('El nombre no coincide. Escríbelo exactamente.','error');
      return;
    }
    const { pending }=syncStatus();
    const warn=pending
      ? `Hay ${pending} cambio(s) sin subir. Se perderán.\n\n¿Borrar definitivamente “${expected}” y todos sus datos?`
      : `¿Borrar definitivamente “${expected}” y todos sus datos (órdenes, menú, inventario)? Esta acción no se puede deshacer.`;
    if(!confirm(warn)) return;

    const btn=document.getElementById('biz-delete-btn');
    if(btn) btn.disabled=true;
    try{
      const next=await deleteMyBusiness({ businessId:state.businessId, confirmName:typed });
      toast(next
        ? `✔ Negocio borrado. Entrando a ${next.ticketName||next.name}…`
        : '✔ Negocio borrado.','success');
      location.reload();
    }catch(err){
      toast('Error: '+err.message,'error');
      if(btn) btn.disabled=false;
    }
  });
}
