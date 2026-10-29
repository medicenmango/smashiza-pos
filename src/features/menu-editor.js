import { recordMenuPrice, markCatalogOffMenu } from '../domain/catalog.js';
import { MENU_DEFAULT, CAT_LABELS, MENU, getCatLabel } from '../domain/menu.js';
import { renderMenuGrid, renderCategoryBtns } from './nueva-orden.js';
import { state } from '../state.js';
import { persistMenuCatalog } from '../storage/index.js';
import { toast } from '../ui/toast.js';
import { uid, escHtml } from '../utils/format.js';

export function renderMenuEditor(){
  const el=document.getElementById('menu-editor-content');
  const catsFromMenu=[...new Set(MENU.map(i=>i.cat))];
  const catsFromLabels=Object.keys(CAT_LABELS);
  const cats=[...new Set([...catsFromLabels,...catsFromMenu])];

  el.innerHTML=`
    <div class="menu-editor-top">
      <button class="btn-primary btn-inline" id="btn-add-product" style="width:auto">➕ NUEVO PRODUCTO</button>
      <button class="btn-primary btn-inline" id="btn-add-category" style="width:auto;background:var(--blue-mid);box-shadow:0 4px 0 var(--blue)">🗂️ NUEVA CATEGORÍA</button>
      <button class="btn-secondary btn-inline" id="btn-reset-menu">↩ RESTAURAR DEFAULTS</button>
    </div>
    ${cats.map(cat=>{
      // Get items in custom order
      const orderArr=state.menuOrder[cat]||[];
      const catItems=MENU.filter(i=>i.cat===cat);
      const ordered=[
        ...orderArr.map(id=>catItems.find(i=>i.id===id)).filter(Boolean),
        ...catItems.filter(i=>!orderArr.includes(i.id)),
      ];
      return `
      <div class="menu-editor-section">
        <div class="menu-editor-cat-header">
          <input class="pixel-input menu-editor-cat cat-rename" data-cat="${cat}" value="${escHtml(getCatLabel(cat))}" title="Renombrar categoría (el ID no cambia)"/>
          <button class="btn-del-cat" data-cat="${cat}" title="Eliminar categoría">🗑️ cat</button>
        </div>
        ${ordered.map((item,idx)=>`
          <div class="menu-editor-row" data-id="${item.id}" data-cat="${cat}">
            <div class="sort-handle" title="Arrastrar para reordenar">⠿</div>
            <button class="sort-btn" data-id="${item.id}" data-cat="${cat}" data-dir="up" title="Subir" ${idx===0?'disabled':''}>▲</button>
            <button class="sort-btn" data-id="${item.id}" data-cat="${cat}" data-dir="down" title="Bajar" ${idx===ordered.length-1?'disabled':''}>▼</button>
            <input class="pixel-input med-emoji" data-id="${item.id}" data-field="emoji" value="${escHtml(item.emoji)}" placeholder="🍔" style="width:50px;text-align:center;font-size:1.2rem"/>
            <input class="pixel-input med-name" data-id="${item.id}" data-field="name" value="${escHtml(item.name)}" placeholder="Nombre" />
            <input class="pixel-input med-price" type="number" data-id="${item.id}" data-field="price" value="${item.price}" placeholder="Precio" min="0" step="1" />
            <select class="pixel-input med-cat" data-id="${item.id}" data-field="cat">
              ${cats.map(c=>`<option value="${c}" ${c===item.cat?'selected':''}>${getCatLabel(c)}</option>`).join('')}
            </select>
            <button class="btn-del-menu" data-id="${item.id}" title="Eliminar producto">🗑️</button>
          </div>`).join('')}
        ${ordered.length===0?'<div class="empty-list" style="padding:.5rem">Categoría vacía</div>':''}
      </div>`;
    }).join('')}`;

  // Rename category label (ID stays the same)
  el.querySelectorAll('.cat-rename').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const id=inp.dataset.cat;
      const label=inp.value.trim();
      if(!label){
        inp.value=getCatLabel(id);
        toast('El nombre de la categoría no puede estar vacío','error');
        return;
      }
      CAT_LABELS[id]=label;
      persistMenuCatalog(true);
      refreshCategoryLabels();
      toast('✔ Categoría: '+label,'success');
    });
  });

  // Sort buttons ▲▼
  el.querySelectorAll('.sort-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat, id=btn.dataset.id, dir=btn.dataset.dir;
      const catItems=MENU.filter(i=>i.cat===cat);
      const orderArr=state.menuOrder[cat]||catItems.map(i=>i.id);
      // Ensure all items are in orderArr
      catItems.forEach(i=>{ if(!orderArr.includes(i.id)) orderArr.push(i.id); });
      const idx=orderArr.indexOf(id);
      if(dir==='up'&&idx>0){ [orderArr[idx-1],orderArr[idx]]=[orderArr[idx],orderArr[idx-1]]; }
      else if(dir==='down'&&idx<orderArr.length-1){ [orderArr[idx+1],orderArr[idx]]=[orderArr[idx],orderArr[idx+1]]; }
      state.menuOrder[cat]=orderArr;
      persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
    });
  });

  // Field changes
  el.querySelectorAll('.med-emoji,.med-name,.med-price,.med-cat').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const id=inp.dataset.id,field=inp.dataset.field;
      const item=MENU.find(i=>i.id===id); if(!item) return;
      if(field==='price'){
        const p=parseFloat(inp.value)||0;
        recordMenuPrice(item.name,p,item);
        item.price=p;
      } else item[field]=inp.value.trim()||item[field];
      persistMenuCatalog(); renderMenuGrid();
      if(field==='cat') renderMenuEditor();
    });
  });

  // Delete product
  el.querySelectorAll('.btn-del-menu').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('¿Eliminar este producto?')) return;
      const item=MENU.find(i=>i.id===btn.dataset.id);
      if(item) markCatalogOffMenu(item);
      MENU.splice(MENU.findIndex(i=>i.id===btn.dataset.id),1);
      persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
    });
  });

  // Delete category
  el.querySelectorAll('.btn-del-cat').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat;
      if(MENU.some(i=>i.cat===cat)){ toast('⚠️ Mueve o elimina los productos primero','error'); return; }
      delete CAT_LABELS[cat];
      persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
      toast('✔ Categoría eliminada','success');
    });
  });

  document.getElementById('btn-add-product').addEventListener('click',()=>openAddProductModal());
  document.getElementById('btn-add-category').addEventListener('click',()=>openAddCategoryModal());
  document.getElementById('btn-reset-menu').addEventListener('click',()=>{
    if(!confirm('¿Restaurar el menú original? Esto reemplaza el menú del Excel. Los costos se conservan.')) return;
    MENU.length=0; MENU_DEFAULT.forEach(i=>MENU.push(JSON.parse(JSON.stringify(i))));
    Object.keys(CAT_LABELS).forEach(k=>delete CAT_LABELS[k]);
    Object.assign(CAT_LABELS,{smash:'SMASH BURGERS',especial:'PAPAS',extras:'EXTRAS & COMPLEMENTOS',bebidas:'BEBIDAS'});
    state.menuOrder={};
    persistMenuCatalog(true); renderMenuEditor(); renderMenuGrid();
    toast('✔ Menú restaurado','success');
  });
}

export function refreshCategoryLabels(){
  renderCategoryBtns();
  document.querySelectorAll('.med-cat option').forEach(opt=>{
    if(opt.value && opt.value!=='all') opt.textContent=getCatLabel(opt.value);
  });
  const smashT=document.getElementById('ba-title-smash');
  const papaT=document.getElementById('ba-title-papas');
  const bebT=document.getElementById('ba-title-bebidas');
  if(smashT) smashT.textContent=`${getCatLabel('smash')} MÁS VENDIDAS`;
  if(papaT) papaT.textContent=`${getCatLabel('especial')} MÁS VENDIDAS`;
  if(bebT) bebT.textContent=`${getCatLabel('bebidas')} MÁS PEDIDAS`;
}

export function openAddProductModal(){
  const cats=[...new Set([...Object.keys(CAT_LABELS),...MENU.map(i=>i.cat)])];
  const sel=document.getElementById('np-cat');
  sel.innerHTML=cats.map(c=>`<option value="${c}">${getCatLabel(c)}</option>`).join('');
  document.getElementById('np-name').value='';
  document.getElementById('np-price').value='';
  document.getElementById('np-emoji').value='🍔';
  document.getElementById('modal-add-product').classList.remove('hidden');
}

export function openAddCategoryModal(){
  document.getElementById('nc-name').value='';
  document.getElementById('nc-label').value='';
  document.getElementById('modal-add-category').classList.remove('hidden');
}

export function initAddProductModal(){
  const modal=document.getElementById('modal-add-product');
  document.getElementById('btn-np-cancel').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  document.getElementById('btn-np-save').addEventListener('click',()=>{
    const name=document.getElementById('np-name').value.trim();
    const price=parseFloat(document.getElementById('np-price').value)||0;
    const emoji=document.getElementById('np-emoji').value.trim()||'🍔';
    const cat=document.getElementById('np-cat').value;
    if(!name){ toast('Escribe un nombre','error'); return; }
    MENU.push({id:uid(),cat,emoji,name,price});
    recordMenuPrice(name,price,{emoji,cat,name});
    persistMenuCatalog(true); modal.classList.add('hidden');
    renderMenuEditor(); renderMenuGrid(); renderCategoryBtns();
    toast('✔ Producto agregado','success');
  });
}

export function initAddCategoryModal(){
  const modal=document.getElementById('modal-add-category');
  document.getElementById('btn-nc-cancel').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  document.getElementById('btn-nc-save').addEventListener('click',()=>{
    const rawName=document.getElementById('nc-name').value.trim().toLowerCase().replace(/\s+/g,'_');
    const label  =document.getElementById('nc-label').value.trim().toUpperCase();
    if(!rawName||!label){ toast('Llena nombre y etiqueta','error'); return; }
    if(CAT_LABELS[rawName]){ toast('Esa categoría ya existe','error'); return; }
    CAT_LABELS[rawName]=label;
    persistMenuCatalog(true); modal.classList.add('hidden');
    renderMenuEditor(); renderMenuGrid(); renderCategoryBtns();
    toast(`✔ Categoría "${label}" creada`,'success');
  });
}
