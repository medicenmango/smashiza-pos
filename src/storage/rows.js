import { loadCatalog, saveCatalog } from '../domain/catalog.js';
import { CAT_LABELS, saveMenuToStorage, MENU, saveMenuOrder, menuCatsInOrder, orderedMenuItems } from '../domain/menu.js';
import { state } from '../state.js';
import { uid } from '../utils/format.js';

// Menu/catalog as sheet-shaped rows (Excel headers), shared by every backend.

export function menuCatalogRows(){
  const menuRows=[];
  menuCatsInOrder().forEach(cat=>{
    orderedMenuItems(cat).forEach((item,idx)=>{
      menuRows.push({ Id:item.id, Categoria:item.cat, Emoji:item.emoji, Nombre:item.name, Precio:item.price, Orden:idx });
    });
  });
  const catRows=Object.entries(CAT_LABELS).map(([Id,Etiqueta])=>({Id,Etiqueta}));
  const cat=loadCatalog();
  const costRows=Object.entries(cat.costs||{}).filter(([,c])=>c!=null&&c!=='').map(([Producto,Costo])=>({Producto,Costo}));
  const catalogRows=Object.entries(cat.items||{}).map(([Producto,it])=>({
    Producto, Emoji:it.emoji||'🍽️', Categoria:it.cat||'', EnMenu:it.inMenu?'si':'no'
  }));
  const priceRows=[];
  Object.entries(cat.items||{}).forEach(([Producto,it])=>{
    (it.priceHistory||[]).forEach(h=>priceRows.push({ Producto, Desde:h.from||'2000-01-01', Precio:h.price }));
  });
  return { menuRows, catRows, costRows, catalogRows, priceRows };
}

export function applyMenuFromRows(menuRows, catRows){
  if(catRows.length){
    const keep=new Set(catRows.map(r=>String(r.Id||'').trim()).filter(Boolean));
    Object.keys(CAT_LABELS).forEach(k=>{ if(!keep.has(k)) delete CAT_LABELS[k]; });
    catRows.forEach(r=>{
      const id=String(r.Id||'').trim(); if(!id) return;
      CAT_LABELS[id]=String(r.Etiqueta||id).trim()||id;
    });
  }
  const sorted=[...menuRows].sort((a,b)=>{
    const ca=String(a.Categoria||'');
    const cb=String(b.Categoria||'');
    if(ca!==cb) return ca.localeCompare(cb);
    return (parseInt(a.Orden)||0)-(parseInt(b.Orden)||0);
  });
  MENU.length=0;
  state.menuOrder={};
  sorted.forEach(r=>{
    const name=String(r.Nombre||'').trim(); if(!name) return;
    const id=String(r.Id||'').trim()||uid();
    const cat=String(r.Categoria||'smash').trim()||'smash';
    MENU.push({ id, cat, emoji:String(r.Emoji||'🍽️').trim()||'🍽️', name, price:Number(r.Precio)||0 });
    if(!state.menuOrder[cat]) state.menuOrder[cat]=[];
    state.menuOrder[cat].push(id);
  });
  saveMenuOrder();
  saveMenuToStorage();
}

export function applyCatalogFromRows(costRows, itemRows, histRows){
  const costs={};
  costRows.forEach(r=>{
    const n=String(r.Producto||'').trim(); if(!n) return;
    const c=parseFloat(r.Costo);
    if(isFinite(c)&&c>0) costs[n]=c;
  });
  const items={};
  itemRows.forEach(r=>{
    const n=String(r.Producto||'').trim(); if(!n) return;
    const flag=String(r.EnMenu||'si').trim().toLowerCase();
    items[n]={
      emoji:String(r.Emoji||'🍽️').trim()||'🍽️',
      cat:String(r.Categoria||'').trim(),
      inMenu:!(flag==='no'||flag==='0'||flag==='false'),
      priceHistory:[],
    };
  });
  histRows.forEach(r=>{
    const n=String(r.Producto||'').trim(); if(!n) return;
    if(!items[n]) items[n]={ emoji:'🍽️', cat:'', inMenu:false, priceHistory:[] };
    items[n].priceHistory.push({ from:String(r.Desde||'2000-01-01'), price:Number(r.Precio)||0 });
  });
  saveCatalog({ costs, items });
}
