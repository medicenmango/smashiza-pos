import { applyChromeBranding, activeBranding } from '../domain/branding.js';
import { state } from '../state.js';
import {
  updateMyBusinessBranding, uploadBusinessLogo, clearBusinessLogo, createMyBusiness,
} from '../storage/supabase.js';
import { toast } from '../ui/toast.js';
import { escHtml } from '../utils/format.js';

function isOwner(){
  return state.cloud && state.businessRole==='owner';
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
}

export function initNegocioTab(){
  const form=document.getElementById('biz-branding-form');
  if(!form) return;

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
}

