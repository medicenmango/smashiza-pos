import { SMASHIZA_BUSINESS_ID } from '../constants.js';
import { state } from '../state.js';

/** Menú histórico de La Smashiza (solo tenant #1 / restore Smashiza). */
export const MENU_SMASHIZA_DEFAULT = [
  { id:'s1', cat:'smash',    emoji:'🍔', name:'La Master',        price:159 },
  { id:'s2', cat:'smash',    emoji:'🍔', name:'El Santos',         price:159 },
  { id:'s3', cat:'smash',    emoji:'🍔', name:'La de Cajon',       price:159 },
  { id:'s4', cat:'smash',    emoji:'🍔', name:'Un Clasico',        price:159 },
  { id:'s5', cat:'smash',    emoji:'🍔', name:'Paraiso',           price:179 },
  { id:'s6', cat:'smash',    emoji:'🍔', name:'Tocho',             price:179 },
  { id:'s7', cat:'smash',    emoji:'🧀', name:'QuesaBurger',       price:119 },
  { id:'e1', cat:'especial', emoji:'🍟', name:'Algo Tranqui CH',   price:59  },
  { id:'e2', cat:'especial', emoji:'🍟', name:'Algo Tranqui G',    price:89  },
  { id:'e3', cat:'especial', emoji:'🍟', name:'Algo Bello CH',     price:79  },
  { id:'e4', cat:'especial', emoji:'🍟', name:'Algo Bello G',      price:99  },
  { id:'e5', cat:'especial', emoji:'🍟', name:'Las Monchosas CH',  price:109 },
  { id:'e6', cat:'especial', emoji:'🍟', name:'Las Monchosas G',   price:129 },
  { id:'x1', cat:'extras',   emoji:'🥫', name:'Aderezo Especial',  price:15  },
  { id:'x2', cat:'extras',   emoji:'🌶️', name:'Aderezo Jalapeño', price:15  },
  { id:'x3', cat:'extras',   emoji:'🥫', name:'Catsup',            price:15  },
  { id:'x4', cat:'extras',   emoji:'🌶️', name:'Chile en rajas',   price:15  },
  { id:'x5', cat:'extras',   emoji:'🥒', name:'Pepinillos',        price:15  },
  { id:'x6', cat:'extras',   emoji:'🍍', name:'Extra Piña',        price:15  },
  { id:'x7', cat:'extras',   emoji:'🥗', name:'Extra Ranch',       price:15  },
  { id:'x8', cat:'extras',   emoji:'🥓', name:'Extra Tocino',      price:15  },
  { id:'b1', cat:'bebidas',  emoji:'🧃', name:'Boing',             price:25  },
];

/** @deprecated usar MENU_SMASHIZA_DEFAULT */
export const MENU_DEFAULT = MENU_SMASHIZA_DEFAULT;

export const CAT_LABELS_SMASHIZA = {
  smash:'SMASH BURGERS', especial:'PAPAS',
  extras:'EXTRAS & COMPLEMENTOS', bebidas:'BEBIDAS',
};

/** Plantilla genérica: categorías vacías, sin productos Smashiza. */
export const CAT_LABELS_GENERIC = {
  platillos:'PLATILLOS',
  bebidas:'BEBIDAS',
  extras:'EXTRAS',
};

export const CAT_LABELS = { ...CAT_LABELS_SMASHIZA };

export function isSmashizaTenant(){
  return !state.cloud || !state.businessId || state.businessId===SMASHIZA_BUSINESS_ID;
}

function menuStorageKey(){
  if(state.cloud && state.businessId) return `smashiza_menu_v2_${state.businessId}`;
  return 'smashiza_menu_v2';
}

function menuOrderStorageKey(){
  if(state.cloud && state.businessId) return `smashiza_menu_order_${state.businessId}`;
  return 'smashiza_menu_order';
}

function replaceCatLabels(next){
  Object.keys(CAT_LABELS).forEach(k=>delete CAT_LABELS[k]);
  Object.assign(CAT_LABELS, next);
}

/** Categorías Platillos / Bebidas / Extras, sin productos. */
export function applyGenericEmptyCatalog(){
  MENU.length=0;
  replaceCatLabels({ ...CAT_LABELS_GENERIC });
  state.menuOrder={};
  saveMenuOrder();
  saveMenuToStorage();
}

/** Menú completo La Smashiza (solo tenant #1 / Excel demo). */
export function applySmashizaDefaultCatalog(){
  MENU.length=0;
  MENU_SMASHIZA_DEFAULT.forEach(i=>MENU.push(JSON.parse(JSON.stringify(i))));
  replaceCatLabels({ ...CAT_LABELS_SMASHIZA });
  state.menuOrder={};
  saveMenuOrder();
  saveMenuToStorage();
}

/** Starter al dejar un negocio sin menú en nube. */
export function applyStarterCatalogForActiveBusiness(){
  if(isSmashizaTenant()) applySmashizaDefaultCatalog();
  else applyGenericEmptyCatalog();
}

export function loadMenuFromStorage(){
  try{
    const raw=localStorage.getItem(menuStorageKey());
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed.cats){
        replaceCatLabels(parsed.cats);
      }
      return parsed.items || JSON.parse(JSON.stringify(MENU_SMASHIZA_DEFAULT));
    }
  }catch(_){}
  // Sin nube aún: defaults Smashiza para Excel/demo; nube vacía se resuelve al cargar.
  return JSON.parse(JSON.stringify(MENU_SMASHIZA_DEFAULT));
}

export function saveMenuToStorage(){
  if(state.demoMode) return;
  try{
    localStorage.setItem(menuStorageKey(), JSON.stringify({ items:MENU, cats:{ ...CAT_LABELS } }));
  }catch(_){}
}

export let MENU = loadMenuFromStorage();

export function menuCatsInOrder(){
  return [...new Set([...Object.keys(CAT_LABELS), ...MENU.map(i=>i.cat)])];
}

export function orderedMenuItems(cat){
  const catItems=MENU.filter(i=>i.cat===cat);
  const orderArr=state.menuOrder[cat]||[];
  return [
    ...orderArr.map(id=>catItems.find(i=>i.id===id)).filter(Boolean),
    ...catItems.filter(i=>!orderArr.includes(i.id)),
  ];
}

export function saveMenuOrder(){
  if(state.demoMode) return;
  try{
    localStorage.setItem(menuOrderStorageKey(), JSON.stringify(state.menuOrder));
  }catch(_){}
}

export function loadMenuOrderForActiveBusiness(){
  try{
    state.menuOrder=JSON.parse(localStorage.getItem(menuOrderStorageKey())||'{}');
  }catch(_){
    state.menuOrder={};
  }
}

export function getCatLabel(cat){ return CAT_LABELS[cat]||cat.toUpperCase(); }
