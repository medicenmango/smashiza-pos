import { findInvItem, invLevel, recipeLinesForProduct, pushMovement, lowInvItems, restockBuyItems, productsMissingRecipe, duplicateRecipePairs, writeProductRecipes } from '../domain/inventory.js';
import { MENU, menuCatsInOrder, orderedMenuItems, getCatLabel } from '../domain/menu.js';
import { renderDashInvAlerts } from './dashboard.js';
import { reloadData } from './ordenes.js';
import { state } from '../state.js';
import { isReady, saveInventory, downloadInvTemplate } from '../storage/index.js';
import { toast } from '../ui/toast.js';
import { escHtml, fmtInvQty, normInvName } from '../utils/format.js';

export function notifyInventoryResult(res){
  if(!res) return;
  if(res.missing && res.missing.length){
    const uniq=[...new Set(res.missing)];
    toast('⚠️ Sin receta (no se descontó): '+uniq.join(', '),'info',5000);
  }
  if(res.missingIng && res.missingIng.length){
    toast('⚠️ Ingrediente no está en inventario: '+[...new Set(res.missingIng)].join(', '),'error',5000);
  }
  if(res.crossed && res.crossed.length){
    const msg=res.crossed.map(c=>`${c.name} ${c.to==='red'?'🔴':'🟡'} (${fmtInvQty(c.stock)} ${c.unidad||''})`).join(' · ');
    toast('Restock: '+msg, res.crossed.some(c=>c.to==='red')?'error':'info', 6000);
  }
}

export async function persistInv(){
  if(!isReady()){ toast('⚠️ Carga tus datos primero.','error'); return false; }
  try{ await saveInventory(); renderInventory(); renderDashInvAlerts(); return true; }
  catch(e){ toast('Error al guardar: '+e.message,'error'); return false; }
}

export function renderInventory(){
  const badge=document.getElementById('inv-badge');
  const lows=lowInvItems();
  if(badge){
    if(!lows.length) badge.classList.add('hidden');
    else {
      badge.classList.remove('hidden');
      badge.textContent=String(lows.length);
      badge.classList.toggle('crit', lows.some(i=>invLevel(i)==='red'));
    }
  }
  const kpis=document.getElementById('inv-kpis');
  const buy=restockBuyItems();
  if(kpis){
    kpis.innerHTML=`
      <div class="stat-card card"><div class="stat-label">INGREDIENTES</div><div class="stat-value">${state.inventory.length}</div></div>
      <div class="stat-card card"><div class="stat-label">POR COMPRAR</div><div class="stat-value" style="color:${buy.length?'var(--orange)':'var(--green)'}">${buy.length}</div></div>
      <div class="stat-card card"><div class="stat-label">SIN RECETA</div><div class="stat-value">${productsMissingRecipe().length}</div></div>`;
    kpis.parentElement?.querySelectorAll('.inv-warn').forEach(el=>el.remove());
    const dups=duplicateRecipePairs();
    if(dups.length){
      kpis.insertAdjacentHTML('afterend', `<p class="inv-warn" style="color:var(--orange);margin:8px 0">Hay recetas duplicadas (se usa solo la primera): ${dups.map(escHtml).join(', ')}</p>`);
    }
  }
  const restockBody=document.getElementById('inv-restock-tbody');
  if(restockBody){
    if(!buy.length){
      restockBody.innerHTML='<tr><td colspan="5" class="empty-list">Nada por debajo del ideal</td></tr>';
    } else {
      restockBody.innerHTML=buy.map(r=>`<tr>
        <td>${escHtml(r.item['Nombre'])}</td>
        <td>${fmtInvQty(r.stock)}</td>
        <td>${fmtInvQty(r.ideal)}</td>
        <td style="color:var(--yellow);font-weight:700">${fmtInvQty(r.buy)}</td>
        <td>${escHtml(r.item['Unidad']||'')}</td>
      </tr>`).join('');
    }
  }
  const tbody=document.getElementById('inv-tbody');
  if(tbody){
    const q=(document.getElementById('inv-search')?.value||'').trim().toLowerCase();
    const rows=state.inventory.map((item,idx)=>({item,idx}))
      .filter(r=>!q || String(r.item['Nombre']||'').toLowerCase().includes(q));
    if(!state.inventory.length){
      tbody.innerHTML='<tr><td colspan="7" class="empty-list">Sin ingredientes. Usa ＋ o la plantilla Excel.</td></tr>';
    } else if(!rows.length){
      tbody.innerHTML='<tr><td colspan="7" class="empty-list">Ningún ingrediente coincide con la búsqueda.</td></tr>';
    } else {
      tbody.innerHTML=rows.map(({item,idx})=>{
        const lvl=invLevel(item);
        const dot=lvl==='red'?'🔴':lvl==='yellow'?'🟡':'🟢';
        return `<tr class="inv-row-${lvl}" data-idx="${idx}">
          <td class="inv-dot">${dot}</td>
          <td>${escHtml(item['Nombre'])}</td>
          <td>${escHtml(item['Unidad']||'')}</td>
          <td><input type="number" class="pixel-input inv-edit-stock" data-idx="${idx}" value="${fmtInvQty(item['Stock'])}" step="any" style="width:78px"/></td>
          <td><input type="number" class="pixel-input inv-edit-min" data-idx="${idx}" value="${item['Minimo']??''}" step="any" style="width:64px"/></td>
          <td><input type="number" class="pixel-input inv-edit-ideal" data-idx="${idx}" value="${item['Ideal']??''}" step="any" style="width:64px"/></td>
          <td class="inv-stock-btns">
            <button class="btn-secondary btn-inline inv-btn-in" data-idx="${idx}" title="Entrada">+</button>
            <button class="btn-secondary btn-inline inv-btn-waste" data-idx="${idx}" title="Merma">−</button>
            <button class="btn-secondary btn-inline inv-btn-del" data-idx="${idx}" title="Quitar">✕</button>
          </td>
        </tr>`;
      }).join('');
    }
  }
  const miss=document.getElementById('inv-missing-recipes');
  if(miss){
    const list=productsMissingRecipe();
    miss.textContent=list.length?('Sin receta aún: '+list.map(m=>m.name).join(', ')):'Todas las recetas del menú tienen al menos un ingrediente.';
  }
  renderRecipeBoard();
}

export function recipeDraftKey(name){ return normInvName(name); }

export function savedRecipeDraft(name){
  return recipeLinesForProduct(name).map(r=>({
    name:r['Ingrediente'], qty:parseFloat(r['Cantidad'])||0, unidad:r['Unidad']||''
  }));
}

export function getRecipeDraft(name){
  if(!state.recipeDrafts) state.recipeDrafts={};
  const k=recipeDraftKey(name);
  if(!state.recipeDrafts[k]) state.recipeDrafts[k]=savedRecipeDraft(name);
  return state.recipeDrafts[k];
}

export function recipeDraftDirty(name){
  const d=getRecipeDraft(name);
  const s=savedRecipeDraft(name);
  if(d.length!==s.length) return true;
  const sig=arr=>arr.map(l=>normInvName(l.name)+':'+Number(l.qty)).sort().join('|');
  return sig(d)!==sig(s);
}

export function ingOptionsHtml(selected, skipSet){
  const skip=skipSet||new Set();
  const rows=state.inventory.filter(i=>!skip.has(normInvName(i['Nombre'])) || normInvName(i['Nombre'])===normInvName(selected||''));
  if(!rows.length) return '<option value="">Sin ingredientes</option>';
  return rows.map(i=>{
    const n=i['Nombre'];
    return `<option value="${escHtml(n)}" ${n===selected?'selected':''}>${escHtml(n)}</option>`;
  }).join('');
}

export function visibleRecipeProducts(){
  const ui=state.recipeUi||{cat:'all',q:''};
  const q=(ui.q||'').trim().toLowerCase();
  return MENU.filter(m=>{
    if(ui.cat && ui.cat!=='all' && m.cat!==ui.cat) return false;
    if(q && !(`${m.name} ${m.emoji} ${getCatLabel(m.cat)}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function renderRecipeBoard(){
  const board=document.getElementById('rec-board');
  if(!board) return;
  if(!state.recipeUi) state.recipeUi={ cat:'all', q:'', open:new Set(), collapsed:{} };
  const ui=state.recipeUi;
  const chips=document.getElementById('rec-cat-chips');
  if(chips){
    const cats=menuCatsInOrder();
    chips.innerHTML=[
      `<button type="button" class="rec-chip ${ui.cat==='all'?'active':''}" data-cat="all">TODAS</button>`,
      ...cats.map(c=>`<button type="button" class="rec-chip ${ui.cat===c?'active':''}" data-cat="${escHtml(c)}">${escHtml(getCatLabel(c))}</button>`)
    ].join('');
  }
  const bulkIng=document.getElementById('rec-bulk-ing');
  if(bulkIng){
    const cur=bulkIng.value;
    bulkIng.innerHTML='<option value="">Ingrediente a cambiar…</option>'+ingOptionsHtml(cur);
    if(cur && state.inventory.some(i=>i['Nombre']===cur)) bulkIng.value=cur;
  }
  const search=document.getElementById('rec-search');
  if(search && search.value!==(ui.q||'') && document.activeElement!==search) search.value=ui.q||'';

  const visible=visibleRecipeProducts();
  const byCat=new Map();
  visible.forEach(m=>{
    if(!byCat.has(m.cat)) byCat.set(m.cat, []);
    byCat.get(m.cat).push(m);
  });
  const catOrder=menuCatsInOrder().filter(c=>byCat.has(c));
  if(!visible.length){
    board.innerHTML='<div class="empty-list">Ningún producto coincide.</div>';
    return;
  }
  board.innerHTML=catOrder.map(cat=>{
    const items=orderedMenuItems(cat).filter(m=>visible.some(v=>v.name===m.name));
    const withRec=items.filter(m=>recipeLinesForProduct(m.name).length).length;
    const collapsed=!!ui.collapsed[cat];
    return `<section class="rec-cat" data-cat="${escHtml(cat)}">
      <button type="button" class="rec-cat-toggle" data-cat="${escHtml(cat)}">
        <span class="rec-cat-name">${escHtml(getCatLabel(cat))}</span>
        <span class="rec-cat-meta">${withRec}/${items.length} con receta ${collapsed?'▶':'▼'}</span>
      </button>
      <div class="rec-cat-body ${collapsed?'hidden':''}">${items.map(m=>recipeProductHtml(m)).join('')}</div>
    </section>`;
  }).join('');
}

export function recipeProductHtml(m){
  const saved=recipeLinesForProduct(m.name);
  const draft=getRecipeDraft(m.name);
  const dirty=recipeDraftDirty(m.name);
  const open=state.recipeUi.open.has(m.name);
  const pill=dirty?'<span class="rec-pill dirty">SIN GUARDAR</span>'
    : (saved.length?'<span class="rec-pill ok">'+saved.length+' ING</span>':'<span class="rec-pill miss">SIN RECETA</span>');
  const used=new Set(draft.map(l=>normInvName(l.name)));
  const addOpts=ingOptionsHtml('', used);
  const copyOpts=MENU.filter(x=>x.name!==m.name).map(x=>`<option value="${escHtml(x.name)}">${escHtml(x.name)}</option>`).join('');
  const lines=draft.length?draft.map((l,i)=>{
    const item=findInvItem(l.name);
    const unidad=item?item['Unidad']:(l.unidad||'');
    return `<div class="rec-line" data-idx="${i}">
      <select class="pixel-input rec-ing">${ingOptionsHtml(l.name)}</select>
      <input type="number" class="pixel-input rec-qty" value="${l.qty||''}" step="any" min="0"/>
      <span class="rec-unit">${escHtml(unidad)}</span>
      <button type="button" class="btn-secondary btn-inline rec-del">✕</button>
    </div>`;
  }).join(''):'<div class="empty-list">Sin ingredientes. Agrégalos abajo.</div>';
  return `<article class="rec-prod ${saved.length?'':'missing'} ${dirty?'dirty':''}" data-prod="${escHtml(m.name)}">
    <button type="button" class="rec-prod-head">
      <span class="rec-prod-title">${m.emoji} ${escHtml(m.name)}</span>
      <span class="rec-prod-meta">${pill}</span>
    </button>
    <div class="rec-prod-body ${open?'':'hidden'}">
      <div class="rec-copy-row">
        <select class="pixel-input rec-copy-src"><option value="">Copiar receta de…</option>${copyOpts}</select>
        <button type="button" class="btn-secondary btn-inline rec-copy-btn">COPIAR</button>
      </div>
      <div class="rec-lines">${lines}</div>
      <div class="rec-add-row">
        <select class="pixel-input rec-add-ing"><option value="">＋ Ingrediente</option>${addOpts}</select>
        <input type="number" class="pixel-input rec-add-qty" placeholder="Cant." step="any" min="0"/>
        <button type="button" class="btn-primary rec-add-btn" style="width:auto;padding:.4rem .7rem;margin:0">＋</button>
      </div>
      <div class="rec-newing-row">
        <input type="text" class="pixel-input rec-new-name" placeholder="Nuevo ingrediente"/>
        <select class="pixel-input rec-new-unit"><option value="g">g</option><option value="ml">ml</option><option value="pza">pza</option></select>
        <input type="number" class="pixel-input rec-new-qty" placeholder="Cant." step="any" min="0"/>
        <button type="button" class="btn-secondary btn-inline rec-new-btn">CREAR Y AGREGAR</button>
      </div>
      <div class="rec-actions">
        <button type="button" class="btn-primary rec-save-btn" style="width:auto;padding:.5rem 1rem">► GUARDAR RECETA</button>
        <button type="button" class="btn-secondary rec-revert-btn" style="width:auto;margin:0">DESCARTAR</button>
      </div>
    </div>
  </article>`;
}

export async function saveRecipeProduct(productName){
  writeProductRecipes(productName, getRecipeDraft(productName));
  delete state.recipeDrafts[recipeDraftKey(productName)];
  const ok=await persistInv();
  if(ok) toast('✔ Receta de '+productName+' guardada','success');
}

export function initInventoryTab(){
  const add=document.getElementById('btn-inv-add');
  if(!add) return;
  add.addEventListener('click',async()=>{
    const name=document.getElementById('inv-new-name').value.trim();
    if(!name){ toast('Pon un nombre de ingrediente','error'); return; }
    if(findInvItem(name)){ toast('Ya existe ese ingrediente','error'); return; }
    const unidad=document.getElementById('inv-new-unit').value;
    const stock=parseFloat(document.getElementById('inv-new-stock').value)||0;
    const minimo=document.getElementById('inv-new-min').value;
    const ideal=document.getElementById('inv-new-ideal').value;
    state.inventory.push({ Nombre:name, Unidad:unidad, Stock:stock, Minimo:minimo, Ideal:ideal, Proveedor:'', Nota:'' });
    if(stock) pushMovement('compra', name, stock, unidad, '', 'Stock inicial');
    document.getElementById('inv-new-name').value='';
    document.getElementById('inv-new-stock').value='';
    document.getElementById('inv-new-min').value='';
    document.getElementById('inv-new-ideal').value='';
    await persistInv();
    toast('✔ Ingrediente agregado','success');
  });
  document.getElementById('btn-inv-template').addEventListener('click',downloadInvTemplate);
  document.getElementById('btn-inv-reload').addEventListener('click',reloadData);
  const invSearch=document.getElementById('inv-search');
  if(invSearch) invSearch.addEventListener('input',renderInventory);
  initRecipeBoard();
  document.getElementById('inv-tbody').addEventListener('change',async e=>{
    const idx=parseInt(e.target.dataset.idx);
    const item=state.inventory[idx]; if(!item) return;
    if(e.target.classList.contains('inv-edit-stock')){
      const next=parseFloat(e.target.value); if(isNaN(next)) return;
      const prev=parseFloat(item['Stock'])||0;
      const delta=next-prev;
      if(Math.abs(delta)<1e-9) return;
      item['Stock']=next;
      pushMovement('ajuste', item['Nombre'], delta, item['Unidad'], '', 'Edición manual de stock');
      await persistInv();
    }
    if(e.target.classList.contains('inv-edit-min')){ item['Minimo']=e.target.value; await persistInv(); }
    if(e.target.classList.contains('inv-edit-ideal')){ item['Ideal']=e.target.value; await persistInv(); }
  });
  document.getElementById('inv-tbody').addEventListener('click',async e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const idx=parseInt(btn.dataset.idx);
    const item=state.inventory[idx]; if(!item) return;
    if(btn.classList.contains('inv-btn-del')){
      if(!confirm(`¿Quitar ${item['Nombre']} del inventario?`)) return;
      const k=normInvName(item['Nombre']);
      state.inventory.splice(idx,1);
      state.recipes=state.recipes.filter(r=>normInvName(r['Ingrediente'])!==k);
      await persistInv();
      return;
    }
    const kind=btn.classList.contains('inv-btn-in')?'compra':'merma';
    document.getElementById('inv-move-name').value=item['Nombre'];
    document.getElementById('inv-move-kind').value=kind;
    document.getElementById('inv-move-title').textContent=kind==='compra'?'＋ ENTRADA DE STOCK':'MERMA';
    document.getElementById('inv-move-ing').textContent=`${item['Nombre']} · actual ${fmtInvQty(item['Stock'])} ${item['Unidad']||''}`;
    document.getElementById('inv-move-label').textContent=kind==='compra'?'CANTIDAD QUE ENTRA':'CANTIDAD DE MERMA';
    document.getElementById('inv-move-qty').value='';
    document.getElementById('inv-move-nota').value='';
    document.getElementById('modal-inv-move').classList.remove('hidden');
    document.getElementById('inv-move-qty').focus();
  });
  const moveModal=document.getElementById('modal-inv-move');
  document.getElementById('btn-inv-move-cancel').addEventListener('click',()=>moveModal.classList.add('hidden'));
  moveModal.addEventListener('click',e=>{ if(e.target===moveModal) moveModal.classList.add('hidden'); });
  document.getElementById('btn-inv-move-save').addEventListener('click',async()=>{
    const name=document.getElementById('inv-move-name').value;
    const kind=document.getElementById('inv-move-kind').value;
    const item=findInvItem(name); if(!item) return;
    const qty=parseFloat(document.getElementById('inv-move-qty').value);
    if(!qty||qty<=0){ toast('Cantidad inválida','error'); return; }
    const nota=document.getElementById('inv-move-nota').value.trim();
    if(kind==='compra'){
      item['Stock']=(parseFloat(item['Stock'])||0)+qty;
      pushMovement('compra', item['Nombre'], qty, item['Unidad'], '', nota||'Entrada de stock');
    } else {
      item['Stock']=(parseFloat(item['Stock'])||0)-qty;
      pushMovement('merma', item['Nombre'], -qty, item['Unidad'], '', nota||'Merma');
    }
    moveModal.classList.add('hidden');
    await persistInv();
  });
}

export function initRecipeBoard(){
  const chips=document.getElementById('rec-cat-chips');
  if(chips){
    chips.addEventListener('click',e=>{
      const btn=e.target.closest('[data-cat]'); if(!btn) return;
      state.recipeUi.cat=btn.dataset.cat||'all';
      renderRecipeBoard();
    });
  }
  const search=document.getElementById('rec-search');
  if(search){
    search.addEventListener('input',()=>{
      state.recipeUi.q=search.value;
      renderRecipeBoard();
    });
  }
  const bulkBtn=document.getElementById('btn-rec-bulk');
  if(bulkBtn) bulkBtn.addEventListener('click',applyRecipeBulk);
  const board=document.getElementById('rec-board');
  if(!board) return;
  board.addEventListener('click',async e=>{
    const catBtn=e.target.closest('.rec-cat-toggle');
    if(catBtn){
      const cat=catBtn.dataset.cat;
      state.recipeUi.collapsed[cat]=!state.recipeUi.collapsed[cat];
      renderRecipeBoard();
      return;
    }
    const prodEl=e.target.closest('.rec-prod');
    if(!prodEl) return;
    const name=prodEl.dataset.prod;
    if(e.target.closest('.rec-prod-head')){
      if(state.recipeUi.open.has(name)) state.recipeUi.open.delete(name);
      else state.recipeUi.open.add(name);
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-del')){
      const idx=parseInt(e.target.closest('.rec-line')?.dataset.idx);
      const draft=getRecipeDraft(name);
      if(!isNaN(idx)) draft.splice(idx,1);
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-add-btn')){
      const ing=prodEl.querySelector('.rec-add-ing')?.value;
      const qty=parseFloat(prodEl.querySelector('.rec-add-qty')?.value);
      if(!ing){ toast('Elige un ingrediente','error'); return; }
      if(!(qty>0)){ toast('Pon una cantidad','error'); return; }
      const draft=getRecipeDraft(name);
      const item=findInvItem(ing);
      const ex=draft.find(l=>normInvName(l.name)===normInvName(ing));
      if(ex) ex.qty=qty;
      else draft.push({ name:item?item['Nombre']:ing, qty, unidad:item?item['Unidad']:'g' });
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-copy-btn')){
      const src=prodEl.querySelector('.rec-copy-src')?.value;
      if(!src){ toast('Elige de qué producto copiar','error'); return; }
      state.recipeDrafts[recipeDraftKey(name)]=savedRecipeDraft(src).map(l=>({...l}));
      if(!savedRecipeDraft(src).length) toast('Ese producto no tiene receta guardada','error');
      renderRecipeBoard();
      return;
    }
    if(e.target.closest('.rec-new-btn')){
      const newName=(prodEl.querySelector('.rec-new-name')?.value||'').trim();
      const unidad=prodEl.querySelector('.rec-new-unit')?.value||'g';
      const qty=parseFloat(prodEl.querySelector('.rec-new-qty')?.value);
      if(!newName){ toast('Pon el nombre del ingrediente','error'); return; }
      if(!(qty>0)){ toast('Pon una cantidad','error'); return; }
      if(!findInvItem(newName)){
        state.inventory.push({ Nombre:newName, Unidad:unidad, Stock:0, Minimo:'', Ideal:'', Proveedor:'', Nota:'' });
        const persisted=await persistInv();
        if(!persisted) return;
      }
      const item=findInvItem(newName);
      const draft=getRecipeDraft(name);
      const ex=draft.find(l=>normInvName(l.name)===normInvName(newName));
      if(ex){ ex.qty=qty; ex.unidad=item?item['Unidad']:unidad; }
      else draft.push({ name:item?item['Nombre']:newName, qty, unidad:item?item['Unidad']:unidad });
      state.recipeUi.open.add(name);
      renderRecipeBoard();
      toast('Ingrediente listo. Guarda la receta cuando termines.','info');
      return;
    }
    if(e.target.closest('.rec-save-btn')){
      await saveRecipeProduct(name);
      return;
    }
    if(e.target.closest('.rec-revert-btn')){
      delete state.recipeDrafts[recipeDraftKey(name)];
      renderRecipeBoard();
    }
  });
  const syncLine=e=>{
    const prodEl=e.target.closest('.rec-prod'); if(!prodEl) return;
    const name=prodEl.dataset.prod;
    const line=e.target.closest('.rec-line'); if(!line) return;
    const idx=parseInt(line.dataset.idx);
    const draft=getRecipeDraft(name);
    if(!draft[idx]) return;
    if(e.target.classList.contains('rec-ing')){
      const item=findInvItem(e.target.value);
      draft[idx].name=item?item['Nombre']:e.target.value;
      draft[idx].unidad=item?item['Unidad']:draft[idx].unidad;
    }
    if(e.target.classList.contains('rec-qty')){
      draft[idx].qty=parseFloat(e.target.value)||0;
    }
    const head=prodEl.querySelector('.rec-prod-meta');
    if(head) head.innerHTML=recipeDraftDirty(name)?'<span class="rec-pill dirty">SIN GUARDAR</span>'
      : '<span class="rec-pill ok">'+getRecipeDraft(name).length+' ING</span>';
    prodEl.classList.toggle('dirty', recipeDraftDirty(name));
  };
  board.addEventListener('change',syncLine);
  board.addEventListener('input',e=>{ if(e.target.classList.contains('rec-qty')) syncLine(e); });
}

export async function applyRecipeBulk(){
  const ing=document.getElementById('rec-bulk-ing')?.value;
  const qty=parseFloat(document.getElementById('rec-bulk-qty')?.value);
  const addMissing=!!document.getElementById('rec-bulk-add')?.checked;
  if(!ing){ toast('Elige el ingrediente a cambiar','error'); return; }
  if(!(qty>0)){ toast('Pon la cantidad nueva','error'); return; }
  const item=findInvItem(ing); if(!item){ toast('Ese ingrediente no está en stock','error'); return; }
  const vis=visibleRecipeProducts();
  if(!vis.length){ toast('No hay productos visibles','error'); return; }
  const ik=normInvName(item['Nombre']);
  let n=0;
  vis.forEach(m=>{
    const draft=getRecipeDraft(m.name);
    const line=draft.find(l=>normInvName(l.name)===ik);
    if(line){ line.qty=qty; line.unidad=item['Unidad']; n++; }
    else if(addMissing){ draft.push({ name:item['Nombre'], qty, unidad:item['Unidad'] }); n++; }
  });
  if(!n){ toast('Ningún producto visible tenía '+item['Nombre']+' (marca “agrégalo” si quieres)','info'); return; }
  if(!confirm(`¿Poner ${item['Nombre']} = ${fmtInvQty(qty)} ${item['Unidad']||''} en ${n} producto(s) visible(s) y guardar?`)) return;
  vis.forEach(m=>writeProductRecipes(m.name, getRecipeDraft(m.name)));
  vis.forEach(m=>delete state.recipeDrafts[recipeDraftKey(m.name)]);
  const ok=await persistInv();
  if(ok) toast(`✔ ${item['Nombre']} actualizado en ${n} recetas`,'success');
}
