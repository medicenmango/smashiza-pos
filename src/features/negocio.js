import { isOwner } from '../auth/roles.js';
import {
  applyChromeBranding, activeBranding, THEME_PRESETS, normalizeHex,
  normalizeFont, fontStack, POWERED_BY_SMASHIZA,
} from '../domain/branding.js';
import { SMASHIZA_BUSINESS_ID } from '../constants.js';
import { state } from '../state.js';
import {
  updateMyBusinessBranding, uploadBusinessLogo, clearBusinessLogo, createMyBusiness,
  switchActiveBusiness, resolveActiveBusiness, syncStatus, updateMyBusinessTheme,
  deleteMyBusiness, listBusinessMembers, createBusinessCashier, removeBusinessMember,
  currentUser, listPlatformBusinesses, provisionCustomerBusiness, setBusinessSuspended,
} from '../storage/supabase.js';
import { toast } from '../ui/toast.js';
import { escHtml } from '../utils/format.js';

const ROLE_LABEL={ owner:'Dueño', cashier:'Cajero', kitchen:'Cocina' };

function readThemeFromPickers(){
  return {
    primary:normalizeHex(document.getElementById('biz-color-primary')?.value, '#e63232'),
    secondary:normalizeHex(document.getElementById('biz-color-secondary')?.value, '#1a3bcc'),
    bg:normalizeHex(document.getElementById('biz-color-bg')?.value, '#0d0820'),
    fontFamily:normalizeFont(document.getElementById('biz-font')?.value),
    fontColor:normalizeHex(document.getElementById('biz-font-color')?.value, '#ffd700'),
  };
}

function renderLookPreview(){
  const box=document.getElementById('biz-look-preview');
  if(!box) return;
  const t=readThemeFromPickers();
  const name=(document.getElementById('biz-ticket-name')?.value||'').trim()||activeBranding().name;
  box.style.background=t.bg;
  box.style.borderColor=t.primary;
  const nameEl=document.getElementById('biz-look-name');
  if(nameEl){
    nameEl.textContent=name.toUpperCase();
    nameEl.style.fontFamily=fontStack(t.fontFamily);
    nameEl.style.color=t.fontColor;
  }
  const powered=box.querySelector('.biz-look-powered');
  if(powered) powered.textContent=POWERED_BY_SMASHIZA;
  const logo=document.getElementById('biz-look-logo');
  const url=activeBranding().logoUrl;
  if(logo){
    if(url){
      logo.src=url;
      logo.classList.remove('hidden');
    } else {
      logo.removeAttribute('src');
      logo.classList.add('hidden');
    }
  }
}

function applyLiveLook(){
  const t=readThemeFromPickers();
  state.colorPrimary=t.primary;
  state.colorSecondary=t.secondary;
  state.colorBg=t.bg;
  state.fontFamily=t.fontFamily;
  state.fontColor=t.fontColor;
  const name=document.getElementById('biz-ticket-name');
  if(name) state.ticketName=name.value.trim();
  applyChromeBranding();
  renderLookPreview();
}

function fillThemePickers(theme){
  const t=theme||activeBranding();
  const p=document.getElementById('biz-color-primary');
  const s=document.getElementById('biz-color-secondary');
  const bg=document.getElementById('biz-color-bg');
  if(p) p.value=normalizeHex(t.primary||state.colorPrimary, '#e63232');
  if(s) s.value=normalizeHex(t.secondary||state.colorSecondary, '#1a3bcc');
  if(bg) bg.value=normalizeHex(t.bg||state.colorBg, '#0d0820');
  const font=document.getElementById('biz-font');
  const ink=document.getElementById('biz-font-color');
  if(font) font.value=normalizeFont(t.fontFamily||state.fontFamily);
  if(ink) ink.value=normalizeHex(t.fontColor||state.fontColor, '#ffd700');
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
    form.querySelectorAll('input,textarea,select,button').forEach(el=>{
      if(el.id==='biz-refresh-brand') return;
      el.disabled=!isOwner() && el.type!=='button';
    });
  }
  const createWrap=document.getElementById('biz-create-extra');
  if(createWrap) createWrap.classList.toggle('hidden', !state.platformOperator);
  const platform=document.getElementById('biz-platform-block');
  if(platform) platform.classList.toggle('hidden', !state.platformOperator);
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
  renderLookPreview();
  fillSwitcher();
  const team=document.getElementById('biz-team-block');
  if(team) team.classList.toggle('hidden', !isOwner());
}

async function refreshTeamList(){
  const list=document.getElementById('biz-team-list');
  if(!list || !isOwner() || !state.businessId) return;
  list.innerHTML='<li class="setup-hint">Cargando…</li>';
  try{
    const members=await listBusinessMembers();
    const me=await currentUser();
    if(!members.length){
      list.innerHTML='<li class="setup-hint">Sin miembros.</li>';
      return;
    }
    list.innerHTML=members.map(m=>{
      const label=ROLE_LABEL[m.role]||m.role;
      const self=me?.id===m.userId;
      const name=m.display||m.username||m.email||m.userId;
      const canRemove=m.role!=='owner' || (!self && members.filter(x=>x.role==='owner').length>1);
      const removeBtn=canRemove && !self
        ? `<button type="button" class="btn-secondary biz-team-remove" data-user-id="${escHtml(m.userId)}" data-name="${escHtml(name)}">Quitar</button>`
        : '';
      return `<li class="biz-team-row">
        <span class="biz-team-email">${escHtml(name)}${self?' (tú)':''}</span>
        <span class="biz-team-role">${escHtml(label)}</span>
        ${removeBtn}
      </li>`;
    }).join('');
    list.querySelectorAll('.biz-team-remove').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const name=btn.dataset.name||'este usuario';
        if(!confirm(`¿Quitar a ${name} de este negocio?`)) return;
        try{
          await removeBusinessMember({ userId:btn.dataset.userId });
          toast('✔ Miembro quitado.','success');
          await refreshTeamList();
        }catch(err){
          toast('Error: '+err.message,'error');
        }
      });
    });
  }catch(err){
    list.innerHTML=`<li class="setup-hint">No se pudo cargar el equipo: ${escHtml(err.message)}</li>`;
  }
}

function fmtWhen(iso){
  if(!iso) return '';
  try{
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', { dateStyle:'medium' });
  }catch(_){
    return '';
  }
}

async function refreshPlatformList(){
  const list=document.getElementById('biz-platform-list');
  if(!list || !state.platformOperator) return;
  list.innerHTML='<li class="setup-hint">Cargando negocios…</li>';
  try{
    const rows=await listPlatformBusinesses();
    if(!rows.length){
      list.innerHTML='<li class="setup-hint">No hay negocios.</li>';
      return;
    }
    list.innerHTML=rows.map(b=>{
      const smashiza=b.id===SMASHIZA_BUSINESS_ID;
      const status=smashiza?'Siempre activo':(b.suspended?'Suspendido':'Activo');
      const statusCls=smashiza||!b.suspended?'on':'off';
      const when=fmtWhen(b.createdAt);
      const owners=b.owners?`Dueño: ${b.owners}`:'Sin dueño';
      const meta=[owners, `${b.memberCount} en el equipo`, when].filter(Boolean).join(' · ');
      const toggle=smashiza?'':`<button type="button" class="btn-secondary biz-platform-toggle" data-id="${escHtml(b.id)}" data-name="${escHtml(b.name)}" data-suspend="${b.suspended?'0':'1'}">${b.suspended?'Reactivar':'Suspender'}</button>`;
      return `<li class="biz-platform-row">
        <div>
          <div class="biz-platform-name">${escHtml(b.name)}</div>
          <div class="biz-platform-meta">${escHtml(meta)}</div>
        </div>
        <span class="biz-platform-status ${statusCls}">${escHtml(status)}</span>
        ${toggle}
      </li>`;
    }).join('');
    list.querySelectorAll('.biz-platform-toggle').forEach(btn=>{
      btn.addEventListener('click', async()=>{
        const suspend=btn.dataset.suspend==='1';
        const name=btn.dataset.name||'este negocio';
        const ok=confirm(suspend
          ? `¿Suspender “${name}”? No podrán vender ni editar hasta que lo reactives.`
          : `¿Reactivar “${name}”? Vuelven a entrar con su usuario.`);
        if(!ok) return;
        btn.disabled=true;
        try{
          await setBusinessSuspended({ businessId:btn.dataset.id, suspended:suspend });
          toast(suspend?'✔ Negocio suspendido.':'✔ Negocio reactivado.','success');
          await refreshPlatformList();
        }catch(err){
          toast('Error: '+err.message,'error');
          btn.disabled=false;
        }
      });
    });
  }catch(err){
    list.innerHTML=`<li class="setup-hint">No se pudo cargar la lista: ${escHtml(err.message)}</li>`;
  }
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
  refreshTeamList();
  refreshPlatformList();
  resolveActiveBusiness().then(()=>{
    if(meta){
      meta.innerHTML=`Negocio activo: <strong>${escHtml(state.businessName||'—')}</strong>
        · rol: <strong>${escHtml(state.businessRole||'—')}</strong>`;
    }
    fillSwitcher();
    fillThemePickers();
    applyChromeBranding();
    refreshTeamList();
    refreshPlatformList();
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
      const t=readThemeFromPickers();
      await updateMyBusinessTheme({
        colorPrimary:t.primary,
        colorSecondary:t.secondary,
        colorBg:t.bg,
        fontFamily:t.fontFamily,
        fontColor:t.fontColor,
      });
      applyChromeBranding();
      fillForm();
      toast('✔ Look guardado.','success');
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
      applyLiveLook();
      toast(`Preset “${preset.label}” aplicado (guarda para persistir).`,'info');
    });
  });

  ['biz-color-primary','biz-color-secondary','biz-color-bg','biz-font-color','biz-ticket-name'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',()=>{
      if(!isOwner()) return;
      applyLiveLook();
    });
  });
  document.getElementById('biz-font')?.addEventListener('change',()=>{
    if(!isOwner()) return;
    applyLiveLook();
  });

  document.getElementById('biz-provision-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!state.platformOperator){ toast('Solo Smashiza puede dar acceso.','error'); return; }
    const nameEl=document.getElementById('biz-provision-name');
    const userEl=document.getElementById('biz-provision-user');
    const passEl=document.getElementById('biz-provision-password');
    const name=(nameEl?.value||'').trim();
    const username=(userEl?.value||'').trim();
    const password=passEl?.value||'';
    if(!name){ toast('Escribe el nombre del negocio.','error'); return; }
    if(!username){ toast('Escribe el usuario del dueño.','error'); return; }
    if(!password || password.length<6){ toast('Contraseña: mínimo 6 caracteres.','error'); return; }
    const btn=document.getElementById('biz-provision-btn');
    if(btn) btn.disabled=true;
    try{
      const created=await provisionCustomerBusiness({ name, username, password });
      if(nameEl) nameEl.value='';
      if(userEl) userEl.value='';
      if(passEl) passEl.value='';
      const result=document.getElementById('biz-provision-result');
      if(result){
        result.classList.remove('hidden');
        result.textContent=`Listo: ${created.name}. Usuario “${created.username}”. Anota la contraseña ahora; no se vuelve a mostrar. El dueño entra con eso y crea a sus cajeros en EQUIPO.`;
      }
      toast(`✔ Acceso creado para ${created.username}.`,'success');
      await refreshPlatformList();
    }catch(err){
      toast('Error: '+err.message,'error');
    }finally{
      if(btn) btn.disabled=false;
    }
  });

  document.getElementById('biz-create-extra-btn')?.addEventListener('click',async()=>{
    if(!state.platformOperator) return;
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

  document.getElementById('biz-invite-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!isOwner()){ toast('Solo el dueño puede crear cajeros.','error'); return; }
    const userInput=document.getElementById('biz-invite-user');
    const passInput=document.getElementById('biz-invite-password');
    const username=(userInput?.value||'').trim();
    const password=passInput?.value||'';
    if(!username){ toast('Escribe el usuario del cajero.','error'); return; }
    if(!password || password.length<6){ toast('Contraseña: mínimo 6 caracteres.','error'); return; }
    const btn=document.getElementById('biz-invite-btn');
    if(btn) btn.disabled=true;
    try{
      await createBusinessCashier({ username, password });
      if(userInput) userInput.value='';
      if(passInput) passInput.value='';
      toast(`✔ Cajero “${username}” creado. Ya puede entrar.`,'success');
      await refreshTeamList();
    }catch(err){
      toast('Error: '+err.message,'error');
    }finally{
      if(btn) btn.disabled=false;
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
