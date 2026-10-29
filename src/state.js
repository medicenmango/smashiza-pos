export const state = {
  fileHandle:null, fileName:'', workbook:null, sheetName:'Ordenes',
  allOrders:[], inventory:[], recipes:[], movements:[],
  cart:[], payMethod:'Efectivo', activeCat:'all',
  menuSearch:'', ajuste:0,
  // Dashboard multi-date
  dashSelectedDates: new Set(),
  // Clients sort
  clientsSort: { col:'total', dir:'desc' },
  // Menu item sort order per cat (map cat -> ordered id array)
  menuOrder: JSON.parse(localStorage.getItem('smashiza_menu_order')||'{}'),
  recipeUi: { cat:'all', q:'', open:new Set(), collapsed:{} },
  recipeDrafts: {},
  demoMode: false,
};
