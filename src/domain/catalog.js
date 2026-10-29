import { MENU } from './menu.js';
import { parseOrderItems } from './orders.js';
import { state } from '../state.js';
import { today } from '../utils/format.js';

export let catalogCache=null;

// ── COST PERSISTENCE ──────────────────────────────────────
export function loadCosts(){
  return loadCatalog().costs;
}

export function saveCosts(partial, removeEmptyFrom){
  const cat=loadCatalog();
  if(removeEmptyFrom){
    removeEmptyFrom.forEach(name=>{
      if(partial[name]==null) delete cat.costs[name];
    });
  }
  Object.keys(partial).forEach(k=>{ cat.costs[k]=partial[k]; });
  saveCatalog(cat);
}

export function loadCatalog(){
  if(catalogCache) return catalogCache;
  try{
    const raw=JSON.parse(localStorage.getItem('smashiza_catalog_v1')||'null');
    if(raw && typeof raw==='object'){
      catalogCache={ costs: raw.costs||{}, items: raw.items||{} };
      return catalogCache;
    }
  }catch(_){}
  let costs={};
  try{ costs=JSON.parse(localStorage.getItem('smashiza_costs')||'{}'); }catch(_){}
  catalogCache={ costs, items:{} };
  return catalogCache;
}

export function saveCatalog(cat){
  catalogCache=cat;
  if(state.demoMode) return;
  try{ localStorage.setItem('smashiza_catalog_v1', JSON.stringify(cat)); }
  catch(_){}
}

export function soldProductNames(){
  const s=new Set();
  (state.allOrders||[]).forEach(o=>parseOrderItems(o).forEach(({name})=>{ if(name) s.add(name); }));
  return s;
}

export function ensureCatalogItem(cat, name, extra={}){
  if(!cat.items[name]) cat.items[name]={ emoji:extra.emoji||'🍽️', cat:extra.cat||'', inMenu:!!extra.inMenu, priceHistory:[] };
  if(extra.emoji) cat.items[name].emoji=extra.emoji;
  if(extra.cat) cat.items[name].cat=extra.cat;
  if(extra.inMenu!=null) cat.items[name].inMenu=extra.inMenu;
  return cat.items[name];
}

export function recordMenuPrice(name, price, extra={}){
  const cat=loadCatalog();
  const it=ensureCatalogItem(cat,name,{...extra,name,inMenu:true});
  const p=Number(price)||0;
  const hist=it.priceHistory||[];
  const last=hist[hist.length-1];
  const d=today();
  if(!hist.length) hist.push({from:'2000-01-01',price:p});
  else if(last.price!==p){
    if(last.from===d) last.price=p;
    else hist.push({from:d,price:p});
  }
  it.priceHistory=hist;
  saveCatalog(cat);
}

export function markCatalogOffMenu(item){
  if(!item) return;
  const cat=loadCatalog();
  const it=ensureCatalogItem(cat,item.name,{emoji:item.emoji,cat:item.cat,inMenu:false});
  it.inMenu=false;
  const p=Number(item.price)||0;
  const hist=it.priceHistory||[];
  if(!hist.length) hist.push({from:'2000-01-01',price:p});
  it.priceHistory=hist;
  saveCatalog(cat);
}

export function syncCatalogFromMenu(){
  const cat=loadCatalog();
  const menuNames=new Set(MENU.map(m=>m.name));
  MENU.forEach(m=>{
    const it=ensureCatalogItem(cat,m.name,{emoji:m.emoji,cat:m.cat,inMenu:true});
    it.inMenu=true;
    const p=Number(m.price)||0;
    if(!it.priceHistory.length) it.priceHistory.push({from:'2000-01-01',price:p});
  });
  Object.keys(cat.items).forEach(n=>{
    if(!menuNames.has(n)) cat.items[n].inMenu=false;
  });
  soldProductNames().forEach(n=>{
    if(!cat.items[n]) ensureCatalogItem(cat,n,{inMenu:menuNames.has(n)});
  });
  saveCatalog(cat);
  return cat;
}

export function priceAt(name, fecha){
  const cat=loadCatalog();
  const hist=(cat.items[name]?.priceHistory||[]).slice().sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  if(!hist.length){
    const m=MENU.find(i=>i.name===name);
    return m?Number(m.price)||0:0;
  }
  const f=String(fecha||'').slice(0,10);
  let p=hist[0].price;
  hist.forEach(h=>{ if(String(h.from)<=f) p=h.price; });
  return Number(p)||0;
}

export function costEditorRows(){
  const cat=syncCatalogFromMenu();
  const sold=soldProductNames();
  const names=new Set([...MENU.map(m=>m.name),...sold]);
  return [...names].map(name=>{
    const m=MENU.find(i=>i.name===name);
    const c=cat.items[name]||{};
    return {
      name,
      emoji:m?m.emoji:(c.emoji||'🍽️'),
      cat:m?m.cat:(c.cat||'otros'),
      price:m?m.price:priceAt(name,today()),
      inMenu:!!m,
    };
  });
}
