import { DIAS_SEMANA } from '../constants.js';
import { loadCosts, saveCosts, loadCatalog, syncCatalogFromMenu, priceAt, costEditorRows } from '../domain/catalog.js';
import { CAT_LABELS, MENU, getCatLabel } from '../domain/menu.js';
import { parseOrderItems } from '../domain/orders.js';
import { refreshCategoryLabels } from './menu-editor.js';
import { state } from '../state.js';
import { saveMenuCatalog } from '../storage/index.js';
import { toast } from '../ui/toast.js';
import { pad, fmtDate, fmtMoney, today, escHtml } from '../utils/format.js';

// ── COTO EXTRACTION ───────────────────────────────────────
// "Av Campiña 5424" → "AV CAMPIÑA"
// "Manyara 23"      → "MANYARA"
// "Lemon 45"        → "LEMON"
export function extractCoto(direccion){
  const parts = String(direccion||'').trim().split(/\s+/);
  const words = parts.filter(p => !/^\d+$/.test(p)); // strip pure-number tokens
  return words.join(' ').toUpperCase() || 'SIN COTO';
}

// ── FILTER STATE ──────────────────────────────────────────
export const baRange = { start:null, end:null, picking:false, hovering:null,
                  _viewYear:new Date().getFullYear(), _viewMonth:new Date().getMonth() };

// Selected slicer values (Sets of strings, empty = all)
export const baSlicers = { cotos: new Set(), clientes: new Set() };

// ── SLICER DATA ───────────────────────────────────────────
export function getAllCotos(){
  const s = new Set();
  state.allOrders.filter(o=>o['Estado']!=='Cancelada')
    .forEach(o=>s.add(extractCoto(o['Direccion'])));
  return [...s].sort();
}

export function getAllClientNames(){
  const s = new Set();
  state.allOrders.filter(o=>o['Estado']!=='Cancelada')
    .forEach(o=>s.add((o['Cliente']||'Sin nombre').trim()));
  return [...s].sort();
}

// ── ORDER FILTER ──────────────────────────────────────────
export function getBAOrders(){
  let orders = state.allOrders.filter(o=>o['Estado']!=='Cancelada');
  if(baRange.start){
    const s=baRange.start, e=baRange.end||baRange.start;
    orders=orders.filter(o=>{ const f=String(o['Fecha']||''); return f>=s&&f<=e; });
  }
  if(baSlicers.cotos.size>0){
    orders=orders.filter(o=>baSlicers.cotos.has(extractCoto(o['Direccion'])));
  }
  if(baSlicers.clientes.size>0){
    orders=orders.filter(o=>baSlicers.clientes.has((o['Cliente']||'Sin nombre').trim()));
  }
  return orders;
}

// ── SLICER RENDERER — dropdown multi-select ───────────────
export function renderBASlicers(){
  renderDropdownSlicer('ba-slicer-cotos',   getAllCotos(),       baSlicers.cotos,   '🏘️ ZONA / COTO');
  renderDropdownSlicer('ba-slicer-clientes', getAllClientNames(), baSlicers.clientes,'👤 CLIENTE');
}

export function renderDropdownSlicer(containerId, options, selectedSet, label){
  const wrap=document.getElementById(containerId);
  if(!wrap) return;

  // Build select element
  const selectId=containerId+'-select';
  const allSelected=selectedSet.size===0;

  wrap.innerHTML=`
    <div class="slicer-label">${label}</div>
    <select id="${selectId}" class="pixel-input slicer-select" multiple size="${Math.min(options.length+1,6)}">
      <option value="__all__" ${allSelected?'selected':''}>— TODOS —</option>
      ${options.map(opt=>`
        <option value="${escHtml(opt)}" ${selectedSet.has(opt)?'selected':''}>${escHtml(opt)}</option>
      `).join('')}
    </select>
    ${selectedSet.size>0?`<div class="slicer-active-hint">${selectedSet.size} seleccionado${selectedSet.size>1?'s':''}</div>`:''}`;

  wrap.querySelector('select').addEventListener('change', function(){
    selectedSet.clear();
    const selected=[...this.selectedOptions].map(o=>o.value);
    if(selected.includes('__all__')||selected.length===0){
      selectedSet.clear();
      // Deselect everything except "TODOS"
      [...this.options].forEach(o=>o.selected=(o.value==='__all__'));
    } else {
      selected.filter(v=>v!=='__all__').forEach(v=>selectedSet.add(v));
    }
    renderBASlicers(); // refresh hint text
    renderBA();
  });
}

// ── RANGE PICKER (BA version) ─────────────────────────────
export function initBARangePicker(){
  document.getElementById('btn-ba-hoy').addEventListener('click',()=>{
    baRange.start=today(); baRange.end=today(); baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });
  document.getElementById('btn-ba-semana').addEventListener('click',()=>{
    const d=new Date(); d.setDate(d.getDate()-6);
    baRange.start=fmtDate(d); baRange.end=today(); baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });
  document.getElementById('btn-ba-mes').addEventListener('click',()=>{
    const d=new Date(); d.setDate(1);
    baRange.start=fmtDate(d); baRange.end=today(); baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });
  document.getElementById('btn-ba-todo').addEventListener('click',()=>{
    baRange.start=null; baRange.end=null; baRange.picking=false;
    reBuildBAMonths(); updateBARangeLabel(); renderBA();
  });

  const tog=document.getElementById('btn-ba-toggle-cal');
  const cal=document.getElementById('ba-cal-collapse');
  let open=false;
  function setOpen(v){ open=v; cal.classList.toggle('hidden',!v); tog.textContent=v?'📅 OCULTAR ▲':'📅 RANGO DE FECHAS ▼'; }
  setOpen(false);
  tog.addEventListener('click',()=>setOpen(!open));

  document.getElementById('btn-ba-cal-prev').addEventListener('click',()=>{
    baRange._viewMonth--; if(baRange._viewMonth<0){baRange._viewMonth=11;baRange._viewYear--;} reBuildBAMonths();
  });
  document.getElementById('btn-ba-cal-next').addEventListener('click',()=>{
    baRange._viewMonth++; if(baRange._viewMonth>11){baRange._viewMonth=0;baRange._viewYear++;} reBuildBAMonths();
  });

  reBuildBAMonths();

  const wrap=document.getElementById('ba-cal-months-wrap');
  wrap.addEventListener('click',e=>{
    const el=e.target.closest('.cal-day[data-date]'); if(!el) return;
    const d=el.dataset.date;
    if(!baRange.picking){ baRange.start=d; baRange.end=null; baRange.picking=true; baRange.hovering=null; }
    else{
      if(d<baRange.start){baRange.end=baRange.start;baRange.start=d;}else baRange.end=d;
      baRange.picking=false; baRange.hovering=null;
      updateBARangeLabel(); renderBA();
      document.getElementById('ba-cal-collapse').classList.add('hidden');
      document.getElementById('btn-ba-toggle-cal').textContent='📅 RANGO DE FECHAS ▼';
    }
    reBuildBAMonths();
  });
  wrap.addEventListener('mouseover',e=>{
    if(!baRange.picking) return;
    const el=e.target.closest('.cal-day[data-date]'); if(!el) return;
    if(baRange.hovering===el.dataset.date) return;
    baRange.hovering=el.dataset.date; reBuildBAMonths();
  });
  wrap.addEventListener('mouseleave',()=>{ if(baRange.picking&&baRange.hovering){baRange.hovering=null;reBuildBAMonths();} });
}

export function updateBARangeLabel(){
  const lbl=document.getElementById('ba-range-label');
  if(!lbl) return;
  if(!baRange.start) lbl.textContent='Todo el historial';
  else if(!baRange.end||baRange.start===baRange.end) lbl.textContent=baRange.start;
  else lbl.textContent=`${baRange.start} → ${baRange.end}`;
}

export function reBuildBAMonths(){
  const yr=baRange._viewYear, mo=baRange._viewMonth;
  const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;
  const datesWithOrders=new Set(state.allOrders.map(o=>String(o['Fecha'])));

  function buildBAMonth(year,month){
    const MN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DN=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
    const first=new Date(year,month,1).getDay();
    const days=new Date(year,month+1,0).getDate();
    const hover=baRange.hovering;
    const re=baRange.picking&&hover?(hover>baRange.start?hover:baRange.start):baRange.end;
    const rs=baRange.picking&&hover&&hover<baRange.start?hover:baRange.start;
    let h=`<div class="cal-month-title">${MN[month]} ${year}</div><div class="cal-grid">`;
    DN.forEach(d=>{ h+=`<div class="cal-header-day">${d}</div>`; });
    for(let i=0;i<first;i++) h+=`<div class="cal-day cal-empty"></div>`;
    for(let day=1;day<=days;day++){
      const ds=`${year}-${pad(month+1)}-${pad(day)}`;
      const isSt=ds===baRange.start, isEn=ds===(baRange.end||(baRange.picking&&hover?hover:null));
      const inR=rs&&re&&ds>rs&&ds<re;
      let cls='cal-day';
      if(isSt) cls+=' cal-start'; else if(isEn) cls+=' cal-end'; else if(inR) cls+=' cal-in-range';
      if(ds===today()) cls+=' cal-today';
      h+=`<div class="${cls}" data-date="${ds}">${day}${datesWithOrders.has(ds)?'<span class="cal-dot"></span>':''}</div>`;
    }
    h+='</div>'; return h;
  }

  updateBARangeLabel();
  const cl=document.getElementById('ba-cal-left'), cr=document.getElementById('ba-cal-right');
  if(cl) cl.innerHTML=buildBAMonth(yr,mo);
  if(cr) cr.innerHTML=buildBAMonth(yr2,mo2);
}

export function renderBARangePicker(){ reBuildBAMonths(); }

// ── COST EDITOR ───────────────────────────────────────────
// Always reads from live MENU so new products appear automatically
export function renderCostEditor(){
  const costs=loadCosts();
  const el=document.getElementById('ba-cost-editor');
  if(!el) return;

  const rows=costEditorRows();
  const catOrder=[...new Set([...Object.keys(CAT_LABELS),...rows.map(i=>i.cat)])];

  let html='<div class="cost-editor-grid">';
  catOrder.forEach(cat=>{
    const items=rows.filter(i=>i.cat===cat);
    if(!items.length) return;
    html+=`<div class="cost-cat-header">${getCatLabel(cat)}</div>`;
    items.forEach(item=>{
      const cost=costs[item.name]||'';
      const margin=cost&&item.price?Math.round(((item.price-parseFloat(cost))/item.price)*100):null;
      const mc=margin===null?'var(--beige-dark)':margin>=60?'var(--green)':margin>=40?'var(--orange)':'var(--red-glow)';
      html+=`<div class="cost-row">
        <span class="cost-emoji">${item.emoji}</span>
        <span class="cost-name">${escHtml(item.name)}${item.inMenu?'':' <span class="ba-off-menu">descontinuado</span>'}</span>
        <span class="cost-price">${fmtMoney(item.price)}</span>
        <input class="pixel-input cost-input" type="number" placeholder="Costo $" min="0" step="1"
          data-name="${escHtml(item.name)}" value="${escHtml(String(cost))}"/>
        <span class="cost-margin" style="color:${mc};font-family:var(--mono);font-size:12px;min-width:80px;text-align:right">
          ${margin!==null?margin+'% margen':'—'}
        </span>
      </div>`;
    });
  });
  html+='</div>';
  html+=`<button class="btn-primary" id="btn-save-costs" style="width:auto;padding:.5rem 1.5rem;margin-top:.75rem">💾 GUARDAR COSTOS</button>`;
  el.innerHTML=html;

  el.querySelectorAll('.cost-input').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const name=inp.dataset.name;
      const item=rows.find(i=>i.name===name);
      if(!item) return;
      const cost=parseFloat(inp.value);
      const margin=!isNaN(cost)&&cost>0&&item.price?Math.round(((item.price-cost)/item.price)*100):null;
      const mc=margin===null?'var(--beige-dark)':margin>=60?'var(--green)':margin>=40?'var(--orange)':'var(--red-glow)';
      const marginSpan=inp.parentElement.querySelector('.cost-margin');
      if(marginSpan){ marginSpan.style.color=mc; marginSpan.textContent=margin!==null?margin+'% margen':'—'; }
    });
  });

  document.getElementById('btn-save-costs').addEventListener('click',()=>{
    const names=[];
    const newCosts={};
    el.querySelectorAll('.cost-input').forEach(inp=>{
      names.push(inp.dataset.name);
      const v=parseFloat(inp.value);
      if(!isNaN(v)&&v>0) newCosts[inp.dataset.name]=v;
    });
    saveCosts(newCosts, names);
    saveMenuCatalog(true);
    toast('✔ Costos guardados en el Excel','success');
    renderCostEditor(); renderBA();
  });
}

// ── HOUR DRILL-DOWN MODAL ─────────────────────────────────
export function openHourModal(hour, orders){
  const modal=document.getElementById('modal-hour-detail');
  if(!modal) return;
  const hourOrders=orders.filter(o=>{
    const h=parseInt(String(o['Hora']||'').split(':')[0]);
    return h===hour;
  }).sort((a,b)=>String(b['Fecha']).localeCompare(String(a['Fecha'])));

  document.getElementById('hour-modal-title').textContent=`${pad(hour)}:00 — ${hourOrders.length} órdenes`;

  // Group by weekday to show pattern
  const byDay={};
  hourOrders.forEach(o=>{
    const dt=new Date(String(o['Fecha'])+'T12:00:00');
    const dn=DIAS_SEMANA[dt.getDay()];
    byDay[dn]=(byDay[dn]||0)+1;
  });
  const dayPattern=Object.entries(byDay).map(([d,c])=>`<span class="hour-day-chip">${d}: ${c}</span>`).join('');

  const tbody=hourOrders.slice(0,50).map(o=>`
    <tr>
      <td style="font-family:var(--pixel);font-size:7px;color:var(--yellow)">#${String(o['Num_Orden']||'').padStart(4,'0')}</td>
      <td>${o['Fecha']||''}</td>
      <td>${DIAS_SEMANA[new Date(String(o['Fecha'])+'T12:00:00').getDay()]}</td>
      <td>${escHtml(o['Cliente']||'')}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${escHtml(o['Productos']||'')}</td>
      <td style="font-family:var(--mono);color:var(--green)">${fmtMoney(o['Total']||0)}</td>
      <td>${o['Metodo_Pago']||''}</td>
    </tr>`).join('');

  document.getElementById('hour-modal-body').innerHTML=`
    <div class="hour-day-pattern">${dayPattern}</div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="pixel-table">
        <thead><tr><th>#</th><th>FECHA</th><th>DÍA</th><th>CLIENTE</th><th>PRODUCTOS</th><th>TOTAL</th><th>PAGO</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  modal.classList.remove('hidden');
}

// ── MAIN RENDER ───────────────────────────────────────────
export function renderBA(){
  const orders=getBAOrders();
  syncCatalogFromMenu();
  refreshCategoryLabels();
  const costs=loadCosts();

  // ── KPIs ──────────────────────────────────────────────
  const totalRevenue=orders.reduce((s,o)=>s+(parseFloat(o['Total'])||0),0);
  const totalOrders=orders.length;
  const avgTicket=totalOrders?totalRevenue/totalOrders:0;

  const itemSales={};
  orders.forEach(o=>{
    parseOrderItems(o).forEach(({name,qty})=>{
      const price=priceAt(name, o['Fecha']);
      const cost=costs[name]||0;
      if(!itemSales[name]) itemSales[name]={qty:0,revenue:0,cost:0};
      itemSales[name].qty+=qty;
      itemSales[name].revenue+=price*qty;
      itemSales[name].cost+=cost*qty;
    });
  });

  const totalCOGS=Object.values(itemSales).reduce((s,v)=>s+v.cost,0);
  const grossProfit=totalRevenue-totalCOGS;
  const grossMargin=totalRevenue>0?(grossProfit/totalRevenue)*100:0;
  const costsConfigured=Object.keys(costs).length>0;

  const smashNames=new Set(MENU.filter(i=>i.cat==='smash').map(i=>i.name));
  let totalBurgers=0;
  Object.entries(itemSales).forEach(([name,v])=>{ if(smashNames.has(name)) totalBurgers+=v.qty; });

  const profitHtml=costsConfigured
    ?`<div class="ba-kpi-card kpi-green">
        <div class="ba-kpi-label">UTILIDAD BRUTA</div>
        <div class="ba-kpi-val">${fmtMoney(grossProfit)}</div>
        <div class="ba-kpi-sub">Margen: ${grossMargin.toFixed(1)}%</div>
      </div>
      <div class="ba-kpi-card">
        <div class="ba-kpi-label">COSTO TOTAL</div>
        <div class="ba-kpi-val" style="color:var(--orange)">${fmtMoney(totalCOGS)}</div>
        <div class="ba-kpi-sub">de ingredientes</div>
      </div>`
    :`<div class="ba-kpi-card kpi-dim">
        <div class="ba-kpi-label">UTILIDAD BRUTA</div>
        <div class="ba-kpi-val" style="font-size:12px;color:var(--beige-dark)">Configura costos ↓</div>
      </div>`;

  document.getElementById('ba-kpis').innerHTML=`
    <div class="ba-kpi-card kpi-blue">
      <div class="ba-kpi-label">INGRESOS TOTALES</div>
      <div class="ba-kpi-val">${fmtMoney(totalRevenue)}</div>
      <div class="ba-kpi-sub">${totalOrders} órdenes</div>
    </div>
    <div class="ba-kpi-card">
      <div class="ba-kpi-label">TICKET PROMEDIO</div>
      <div class="ba-kpi-val">${fmtMoney(avgTicket)}</div>
      <div class="ba-kpi-sub">por orden</div>
    </div>
    <div class="ba-kpi-card">
      <div class="ba-kpi-label">HAMBURGUESAS</div>
      <div class="ba-kpi-val">${totalBurgers}</div>
      <div class="ba-kpi-sub">smash vendidas</div>
    </div>
    ${profitHtml}
    <div class="ba-kpi-card">
      <div class="ba-kpi-label">MÉTODOS DE PAGO</div>
      ${['Efectivo','Transferencia','Tarjeta'].map(m=>{
        const cnt=orders.filter(o=>o['Metodo_Pago']===m).length;
        const pct=totalOrders?Math.round(cnt/totalOrders*100):0;
        return `<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px">
          <span style="color:var(--beige-dark)">${m}</span>
          <span style="font-family:var(--mono);color:var(--yellow)">${pct}%</span>
        </div>`;
      }).join('')}
    </div>`;

  // ── TOP PRODUCTS ───────────────────────────────────────
  const sortedItems=Object.entries(itemSales).sort((a,b)=>b[1].qty-a[1].qty);
  const papaNames=new Set(MENU.filter(i=>i.cat==='especial').map(i=>i.name));
  const bebNames =new Set(MENU.filter(i=>i.cat==='bebidas').map(i=>i.name));
  const topBurgers=sortedItems.filter(([n])=>smashNames.has(n)).slice(0,7);
  const topPapas  =sortedItems.filter(([n])=>papaNames.has(n)).slice(0,5);
  const topBebidas=sortedItems.filter(([n])=>bebNames.has(n)).slice(0,5);

  function renderProductBar(name,data,maxQ){
    const item=MENU.find(i=>i.name===name);
    const pct=Math.round((data.qty/maxQ)*100);
    const margin=costs[name]&&item?Math.round(((item.price-costs[name])/item.price)*100):null;
    const mc=margin===null?'var(--beige-dark)':margin>=60?'var(--green)':margin>=40?'var(--orange)':'var(--red-glow)';
    return `<div class="ba-prod-row">
      <span class="ba-prod-emoji">${item?item.emoji:''}</span>
      <div class="ba-prod-info">
        <div class="ba-prod-name">${escHtml(name)}</div>
        <div class="ba-prod-bar-wrap"><div class="ba-prod-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="ba-prod-stats">
        <span class="ba-prod-qty">${data.qty} uds</span>
        <span class="ba-prod-rev">${fmtMoney(data.revenue)}</span>
        ${margin!==null?`<span class="ba-prod-margin" style="color:${mc}">${margin}%</span>`:''}
      </div>
    </div>`;
  }

  document.getElementById('ba-top-burgers').innerHTML=
    topBurgers.length?topBurgers.map(([n,d])=>renderProductBar(n,d,topBurgers[0][1].qty)).join(''):'<div class="empty-list">Sin datos</div>';
  document.getElementById('ba-top-papas').innerHTML=
    topPapas.length?topPapas.map(([n,d])=>renderProductBar(n,d,topPapas[0][1].qty)).join(''):'<div class="empty-list">Sin datos</div>';
  document.getElementById('ba-top-bebidas').innerHTML=
    topBebidas.length?topBebidas.map(([n,d])=>renderProductBar(n,d,topBebidas[0][1].qty)).join(''):'<div class="empty-list">Sin datos</div>';

  // ── COMBOS ─────────────────────────────────────────────
  const comboMap={};
  orders.forEach(o=>{
    const items=parseOrderItems(o);
    const burgers=items.filter(i=>smashNames.has(i.name));
    const others =items.filter(i=>!smashNames.has(i.name));
    burgers.forEach(b=>others.forEach(s=>{
      const k=`${b.name} + ${s.name}`;
      comboMap[k]=(comboMap[k]||0)+1;
    }));
  });
  const topCombos=Object.entries(comboMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const comboEl=document.getElementById('ba-combos');
  if(topCombos.length){
    const maxC=topCombos[0][1];
    comboEl.innerHTML=topCombos.map(([combo,cnt],i)=>{
      const pct=Math.round((cnt/maxC)*100);
      const medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
      return `<div class="ba-combo-row">
        <span class="ba-combo-medal">${medals[i]}</span>
        <div class="ba-combo-info">
          <div class="ba-combo-name">${escHtml(combo)}</div>
          <div class="ba-prod-bar-wrap"><div class="ba-prod-bar" style="width:${pct}%;background:var(--blue-mid)"></div></div>
        </div>
        <span class="ba-combo-cnt">${cnt}x</span>
      </div>`;
    }).join('');
  } else { comboEl.innerHTML='<div class="empty-list">Sin datos de combos</div>'; }

  // ── TOP CLIENTES — group by name only, show most-used address ──
  // Key = nombre (trimmed, case-sensitive as entered)
  // Addresses are merged; we show the most frequent one
  const clientMap={};
  orders.forEach(o=>{
    const name=(o['Cliente']||'Sin nombre').trim();
    const dir =(o['Direccion']||'').trim();
    if(!clientMap[name]) clientMap[name]={total:0,count:0,lastDate:'',addrCount:{}};
    clientMap[name].total+=parseFloat(o['Total'])||0;
    clientMap[name].count++;
    if(String(o['Fecha'])>clientMap[name].lastDate) clientMap[name].lastDate=String(o['Fecha']);
    if(dir) clientMap[name].addrCount[dir]=(clientMap[name].addrCount[dir]||0)+1;
  });
  // Pick most frequent address for display
  Object.values(clientMap).forEach(c=>{
    const entries=Object.entries(c.addrCount);
    c.direccion=entries.length?entries.sort((a,b)=>b[1]-a[1])[0][0]:'—';
  });

  const topBySpend =Object.entries(clientMap).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
  const topByVisits=Object.entries(clientMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);

  function renderClientTable(rows,valueKey){
    return `<table class="pixel-table ba-client-table">
      <thead><tr><th>#</th><th>CLIENTE</th><th>VISITAS</th><th>${valueKey==='total'?'TOTAL GASTADO':'VISITAS'}</th></tr></thead>
      <tbody>${rows.map(([name,d],i)=>{
        const medals=['🥇','🥈','🥉','🏅','🏅'];
        return `<tr>
          <td style="font-size:16px">${medals[i]}</td>
          <td><strong style="color:var(--beige);font-size:13px">${escHtml(name)}</strong></td>
          <td style="text-align:center;color:var(--yellow);font-family:var(--pixel);font-size:9px">${d.count}</td>
          <td style="font-family:var(--mono);color:var(--green);font-size:13px">${valueKey==='total'?fmtMoney(d.total):d.count}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  document.getElementById('ba-top-clients-spend').innerHTML=
    topBySpend.length?renderClientTable(topBySpend,'total'):'<div class="empty-list">Sin datos</div>';
  document.getElementById('ba-top-clients-visits').innerHTML=
    topByVisits.length?renderClientTable(topByVisits,'count'):'<div class="empty-list">Sin datos</div>';

  // ── COTOS ─────────────────────────────────────────────
  const cotoMap={};
  orders.forEach(o=>{
    const coto=extractCoto(o['Direccion']);
    if(!cotoMap[coto]) cotoMap[coto]={total:0,count:0};
    cotoMap[coto].total+=parseFloat(o['Total'])||0;
    cotoMap[coto].count++;
  });
  const topCotos=Object.entries(cotoMap).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
  const cotoEl=document.getElementById('ba-cotos');
  if(topCotos.length){
    const maxCoto=topCotos[0][1].total;
    cotoEl.innerHTML=topCotos.map(([coto,d])=>{
      const pct=Math.round((d.total/maxCoto)*100);
      return `<div class="ba-coto-row">
        <div class="ba-coto-info">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span class="ba-prod-name">${escHtml(coto)}</span>
            <span style="font-size:10px;color:var(--beige-dark)">${d.count} órdenes</span>
          </div>
          <div class="ba-prod-bar-wrap">
            <div class="ba-prod-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--blue-mid),var(--blue-light))"></div>
          </div>
        </div>
        <span class="ba-prod-rev" style="margin-left:.75rem">${fmtMoney(d.total)}</span>
      </div>`;
    }).join('');
  } else { cotoEl.innerHTML='<div class="empty-list">Sin datos</div>'; }

  // ── TICKET DISTRIBUTION ───────────────────────────────
  const buckets=[
    {label:'< $100',min:0,max:100,count:0},
    {label:'$100-$199',min:100,max:200,count:0},
    {label:'$200-$299',min:200,max:300,count:0},
    {label:'$300-$399',min:300,max:400,count:0},
    {label:'$400+',min:400,max:Infinity,count:0},
  ];
  orders.forEach(o=>{
    const t=parseFloat(o['Total'])||0;
    const b=buckets.find(b=>t>=b.min&&t<b.max);
    if(b) b.count++;
  });
  const maxBucket=Math.max(...buckets.map(b=>b.count),1);
  document.getElementById('ba-ticket-dist').innerHTML=buckets.map(b=>{
    const pct=Math.round((b.count/maxBucket)*100);
    const pctOfTotal=totalOrders?Math.round((b.count/totalOrders)*100):0;
    return `<div class="ba-dist-row">
      <span class="ba-dist-label">${b.label}</span>
      <div class="ba-prod-bar-wrap" style="flex:1">
        <div class="ba-prod-bar" style="width:${pct}%;background:var(--blue-mid)"></div>
      </div>
      <span style="font-family:var(--mono);font-size:11px;color:var(--yellow);min-width:55px;text-align:right">${b.count} (${pctOfTotal}%)</span>
    </div>`;
  }).join('');

  // ── HORA PICO — clickable ─────────────────────────────
  const hourMap=Array(24).fill(0).map((_,h)=>({h,count:0,revenue:0}));
  orders.forEach(o=>{
    const h=parseInt(String(o['Hora']||'').split(':')[0]);
    if(h>=0&&h<24){ hourMap[h].count++; hourMap[h].revenue+=parseFloat(o['Total'])||0; }
  });
  const activeHours=hourMap.filter(h=>h.count>0);
  const maxHour=Math.max(...activeHours.map(h=>h.count),1);
  const hourEl=document.getElementById('ba-hora-pico');
  hourEl.innerHTML=activeHours.map(h=>{
    const pct=Math.round((h.count/maxHour)*100);
    const isHot=h.count===maxHour;
    const color=isHot?'var(--red)':pct>=70?'var(--orange)':pct>=40?'var(--blue-mid)':'var(--border)';
    return `<div class="chart-bar-col hour-bar" data-hour="${h.h}" style="min-width:44px;cursor:pointer" title="Ver órdenes de ${pad(h.h)}:00">
      <div class="chart-bar-label-top" style="font-size:8px">${h.count}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar chart-bar-active" style="height:${pct}%;background:${color}"></div>
      </div>
      <div class="chart-bar-day" style="font-size:7px">${pad(h.h)}:00</div>
    </div>`;
  }).join('');

  // Bind hour clicks
  hourEl.querySelectorAll('.hour-bar').forEach(bar=>{
    bar.addEventListener('click',()=>openHourModal(parseInt(bar.dataset.hour), orders));
    bar.addEventListener('mouseenter',()=>bar.style.opacity='.75');
    bar.addEventListener('mouseleave',()=>bar.style.opacity='1');
  });

  // ── PROFIT TABLE ───────────────────────────────────────
  const profitEl=document.getElementById('ba-profit-table-wrap');
  if(costsConfigured){
    const profitItems=Object.entries(itemSales)
      .filter(([n])=>costs[n])
      .map(([name,d])=>{
        const item=MENU.find(i=>i.name===name);
        const price=d.qty?d.revenue/d.qty:priceAt(name,today());
        const cost=costs[name]||0;
        const margin=price>0?((price-cost)/price)*100:0;
        return {name,emoji:item?item.emoji:(loadCatalog().items[name]?.emoji||'🍽️'),qty:d.qty,revenue:d.revenue,cogs:d.cost,profit:d.revenue-d.cost,margin,price,cost,inMenu:!!item};
      })
      .sort((a,b)=>b.profit-a.profit);

    profitEl.innerHTML=profitItems.length?`
      <table class="pixel-table">
        <thead><tr>
          <th>PRODUCTO</th><th>UDS</th><th>PRECIO</th><th>COSTO</th>
          <th>MARGEN</th><th>INGRESOS</th><th>UTILIDAD</th>
        </tr></thead>
        <tbody>${profitItems.map(p=>{
          const mc=p.margin>=60?'var(--green)':p.margin>=40?'var(--orange)':'var(--red-glow)';
          return `<tr>
            <td>${p.emoji} ${escHtml(p.name)}${p.inMenu?'':' <span class="ba-off-menu">descontinuado</span>'}</td>
            <td style="text-align:center;color:var(--yellow);font-family:var(--pixel);font-size:8px">${p.qty}</td>
            <td style="font-family:var(--mono)">${fmtMoney(p.price)}</td>
            <td style="font-family:var(--mono);color:var(--orange)">${fmtMoney(p.cost)}</td>
            <td style="font-family:var(--pixel);font-size:8px;color:${mc}">${p.margin.toFixed(1)}%</td>
            <td style="font-family:var(--mono);color:var(--green)">${fmtMoney(p.revenue)}</td>
            <td style="font-family:var(--mono);color:${p.profit>=0?'var(--green)':'var(--red-glow)'}">${fmtMoney(p.profit)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`
    :'<div class="empty-list">Configura costos arriba para ver rentabilidad</div>';
  } else {
    profitEl.innerHTML='<div class="empty-list" style="padding:1rem">💡 Configura los costos de ingredientes arriba para ver el análisis de rentabilidad por producto</div>';
  }

  // ── AVG PROFIT PER ORDER ──────────────────────────────
  if(costsConfigured){
    let sumP=0,cntP=0;
    orders.forEach(o=>{
      let op=0;
      parseOrderItems(o).forEach(({name,qty})=>{
        const price=priceAt(name, o['Fecha']);
        const cost=costs[name];
        if(cost!==undefined) op+=(price-cost)*qty;
      });
      if(op!==0){sumP+=op;cntP++;}
    });
    const avgP=cntP?sumP/cntP:0;
    const el2=document.getElementById('ba-avg-profit');
    if(el2) el2.textContent=fmtMoney(avgP);
  }

  // Refresh slicers (options may have changed)
  renderBASlicers();
}

// ── INIT ──────────────────────────────────────────────────
export function initBAFilters(){ /* slicers built inside renderBASlicers on renderBA call */ }

export function initBATab(){
  initBARangePicker();
  initBAFilters();
  renderCostEditor();

  // Hour detail modal close
  const hModal=document.getElementById('modal-hour-detail');
  if(hModal){
    document.getElementById('btn-hour-modal-close').addEventListener('click',()=>hModal.classList.add('hidden'));
    hModal.addEventListener('click',e=>{ if(e.target===hModal) hModal.classList.add('hidden'); });
  }

  renderBA();
}
