import { state } from '../state.js';

export const MENU_DEFAULT = [
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

export const CAT_LABELS = {
  smash:'SMASH BURGERS', especial:'PAPAS',
  extras:'EXTRAS & COMPLEMENTOS', bebidas:'BEBIDAS',
};

export function loadMenuFromStorage() {
  try {
    const raw = localStorage.getItem('smashiza_menu_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.cats) Object.keys(parsed.cats).forEach(k => { CAT_LABELS[k] = parsed.cats[k]; });
      return parsed.items || JSON.parse(JSON.stringify(MENU_DEFAULT));
    }
  } catch(_) {}
  return JSON.parse(JSON.stringify(MENU_DEFAULT));
}

export function saveMenuToStorage() {
  if(state.demoMode) return;
  try {
    localStorage.setItem('smashiza_menu_v2', JSON.stringify({ items: MENU, cats: { ...CAT_LABELS } }));
  } catch(_) {}
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
  localStorage.setItem('smashiza_menu_order',JSON.stringify(state.menuOrder));
}

export function getCatLabel(cat){ return CAT_LABELS[cat]||cat.toUpperCase(); }
