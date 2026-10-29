import { invLevel } from '../domain/inventory.js';
import { todayCashInDrawer } from '../domain/orders.js';
import { goToInventarioTab } from './nav.js';
import { renderLiveQueue } from './nueva-orden.js';
import { openOrderDetail, badgeClass } from './ordenes.js';
import { state } from '../state.js';
import { relTime } from '../ui/clock.js';
import { pad, fmtDate, fmtMoney, today, escHtml } from '../utils/format.js';

// Range state: {start:'YYYY-MM-DD', end:'YYYY-MM-DD'} or null = all history
export const dashRange = { start: null, end: null, hovering: null, picking: false };

export function initDashboardFilter(){
  dashRange.start = today();
  dashRange.end   = today();

  // Calendar collapsed by default
  const calWrap = document.getElementById('cal-collapse');
  const toggleBtn = document.getElementById('btn-dash-toggle-cal');
  let calOpen = false;
  function setCalOpen(open){
    calOpen = open;
    calWrap.classList.toggle('hidden', !open);
    toggleBtn.textContent = open ? '📅 OCULTAR CALENDARIO ▲' : '📅 SELECCIONAR FECHAS ▼';
  }
  setCalOpen(false);
  toggleBtn.addEventListener('click', ()=> setCalOpen(!calOpen));

  document.getElementById('btn-dash-hoy').addEventListener('click',()=>{
    dashRange.start=today(); dashRange.end=today(); dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });
  document.getElementById('btn-dash-semana').addEventListener('click',()=>{
    const d=new Date(); d.setDate(d.getDate()-6);
    dashRange.start=fmtDate(d); dashRange.end=today(); dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });
  document.getElementById('btn-dash-mes').addEventListener('click',()=>{
    const d=new Date(); d.setDate(1);
    dashRange.start=fmtDate(d); dashRange.end=today(); dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });
  document.getElementById('btn-dash-todo').addEventListener('click',()=>{
    dashRange.start=null; dashRange.end=null; dashRange.picking=false;
    renderRangePicker(); refreshDashboard(); setCalOpen(false);
  });

  const now=new Date();
  dashRange._viewYear  = now.getFullYear();
  dashRange._viewMonth = now.getMonth();

  document.getElementById('btn-cal-prev').addEventListener('click',()=>{
    dashRange._viewMonth--;
    if(dashRange._viewMonth<0){ dashRange._viewMonth=11; dashRange._viewYear--; }
    rebuildMonthsHtml();
  });
  document.getElementById('btn-cal-next').addEventListener('click',()=>{
    dashRange._viewMonth++;
    if(dashRange._viewMonth>11){ dashRange._viewMonth=0; dashRange._viewYear++; }
    rebuildMonthsHtml();
  });

  renderRangePicker();
}

export function renderRangePicker(){
  const label=document.getElementById('dash-range-label');
  if(label){
    if(!dashRange.start) label.textContent='Todo el historial';
    else if(!dashRange.end||dashRange.start===dashRange.end) label.textContent=dashRange.start;
    else label.textContent=`${dashRange.start} → ${dashRange.end}`;
  }

  const yr=dashRange._viewYear||new Date().getFullYear();
  const mo=dashRange._viewMonth||0;
  const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;

  const calLeft=document.getElementById('cal-left');
  const calRight=document.getElementById('cal-right');
  if(!calLeft||!calRight) return;

  calLeft.innerHTML  = buildMonth(yr, mo);
  calRight.innerHTML = buildMonth(yr2, mo2);

  // Use event delegation on cal-months container — avoids destroying
  // listeners by re-binding on a stable parent instead of each .cal-day
  const calMonths=document.getElementById('cal-months-wrap');
  if(!calMonths) return;

  // Remove old delegated listeners by cloning the node
  const fresh=calMonths.cloneNode(true);
  calMonths.replaceWith(fresh);
  // Re-populate children (cloneNode copies innerHTML too, so grids are intact)

  fresh.addEventListener('click', e=>{
    const el=e.target.closest('.cal-day[data-date]');
    if(!el) return;
    const d=el.dataset.date;
    if(!dashRange.picking){
      dashRange.start=d; dashRange.end=null;
      dashRange.picking=true; dashRange.hovering=null;
    } else {
      if(d<dashRange.start){ dashRange.end=dashRange.start; dashRange.start=d; }
      else dashRange.end=d;
      dashRange.picking=false; dashRange.hovering=null;
      refreshDashboard();
      document.getElementById('cal-collapse')?.classList.add('hidden');
      const tb=document.getElementById('btn-dash-toggle-cal');
      if(tb) tb.textContent='📅 SELECCIONAR FECHAS ▼';
    }
    // Only rebuild the month HTML, not the container
    rebuildMonthsHtml();
  });

  fresh.addEventListener('mouseover', e=>{
    if(!dashRange.picking) return;
    const el=e.target.closest('.cal-day[data-date]');
    if(!el) return;
    if(dashRange.hovering===el.dataset.date) return; // no change
    dashRange.hovering=el.dataset.date;
    rebuildMonthsHtml();
  });

  fresh.addEventListener('mouseleave', ()=>{
    if(!dashRange.picking||!dashRange.hovering) return;
    dashRange.hovering=null;
    rebuildMonthsHtml();
  });
}

// Only rebuild the inner month HTML without touching the event delegation container
export function rebuildMonthsHtml(){
  const yr=dashRange._viewYear||new Date().getFullYear();
  const mo=dashRange._viewMonth||0;
  const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;
  const calLeft=document.getElementById('cal-left');
  const calRight=document.getElementById('cal-right');
  const label=document.getElementById('dash-range-label');
  if(calLeft)  calLeft.innerHTML  = buildMonth(yr, mo);
  if(calRight) calRight.innerHTML = buildMonth(yr2, mo2);
  if(label){
    if(!dashRange.start) label.textContent='Todo el historial';
    else if(!dashRange.end||dashRange.start===dashRange.end) label.textContent=dashRange.start;
    else label.textContent=`${dashRange.start} → ${dashRange.end}`;
  }
}

export function buildMonth(year, month){
  const MONTH_NAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAY_NAMES=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

  // Get all dates that have orders for dot indicator
  const datesWithOrders=new Set(state.allOrders.map(o=>String(o['Fecha'])));

  const firstDay=new Date(year,month,1).getDay(); // 0=Sun
  const daysInMonth=new Date(year,month+1,0).getDate();

  const hover=dashRange.hovering;
  const rangeEnd=dashRange.picking&&hover ? (hover>dashRange.start?hover:dashRange.start) : dashRange.end;
  const rangeStart=dashRange.picking&&hover&&hover<dashRange.start ? hover : dashRange.start;

  let html=`
    <div class="cal-month-title">${MONTH_NAMES[month]} ${year}</div>
    <div class="cal-grid">
      ${DAY_NAMES.map(d=>`<div class="cal-header-day">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div class="cal-day cal-empty"></div>').join('')}`;

  for(let day=1;day<=daysInMonth;day++){
    const dateStr=`${year}-${pad(month+1)}-${pad(day)}`;
    const isStart=dateStr===dashRange.start;
    const isEnd=dateStr===dashRange.end||(dashRange.picking&&dateStr===hover);
    const inRange=rangeStart&&rangeEnd&&dateStr>rangeStart&&dateStr<rangeEnd;
    const isToday=dateStr===today();
    const hasOrders=datesWithOrders.has(dateStr);

    let cls='cal-day';
    if(isStart) cls+=' cal-start';
    else if(isEnd) cls+=' cal-end';
    else if(inRange) cls+=' cal-in-range';
    if(isToday) cls+=' cal-today';

    html+=`<div class="${cls}" data-date="${dateStr}">
      ${day}${hasOrders?'<span class="cal-dot"></span>':''}
    </div>`;
  }
  html+='</div>';
  return html;
}

export function getDashOrders(){
  // No range selected = all history
  if(!dashRange.start) return state.allOrders;
  const s = dashRange.start;
  // If picking (second click not done yet) or end is null, treat as single day
  const e = dashRange.end || dashRange.start;
  return state.allOrders.filter(o=>{
    const f = String(o['Fecha']||'');
    return f >= s && f <= e;
  });
}

export function renderDateChips(){} // kept for compat, no-op

export function refreshDashboard(){
  const periodoO  = getDashOrders();
  const activasO  = periodoO.filter(o=>o['Estado']!=='Cancelada');
  const canceladas= periodoO.filter(o=>o['Estado']==='Cancelada').length;
  const totalOrders=activasO.length;
  const totalVentas=activasO.reduce((s,o)=>s+(parseFloat(o['Total'])||0),0);
  const avgTicket  =totalOrders?totalVentas/totalOrders:0;

  const ticketLabel=document.getElementById('stat-ticket-label');
  if(ticketLabel){
    if(!dashRange.start) ticketLabel.textContent='TICKET PROM. HISTÓRICO';
    else if(dashRange.start===dashRange.end||!dashRange.end) ticketLabel.textContent='TICKET PROM. DÍA';
    else ticketLabel.textContent='TICKET PROM. PERÍODO';
  }

  document.getElementById('stat-ordenes').textContent    =totalOrders;
  document.getElementById('stat-ventas').textContent     =fmtMoney(totalVentas);
  document.getElementById('stat-ticket').textContent     =fmtMoney(avgTicket);
  document.getElementById('stat-canceladas').textContent =canceladas;
  const statCaja=document.getElementById('stat-caja');
  if(statCaja) statCaja.textContent=fmtMoney(todayCashInDrawer());

  document.getElementById('bar-ordenes').style.width    ='60%';
  document.getElementById('bar-ventas').style.width     ='80%';
  document.getElementById('bar-ticket').style.width     ='50%';
  document.getElementById('bar-canceladas').style.width =periodoO.length?`${(canceladas/periodoO.length)*100}%`:'0%';
  const barCaja=document.getElementById('bar-caja');
  if(barCaja) barCaja.style.width='70%';

  // Top burgers
  const cnt={};
  activasO.forEach(o=>{
    if(!o['Productos']) return;
    o['Productos'].split(' | ').forEach((name,i)=>{
      const q=parseInt((o['Cantidades']||'').split(' | ')[i])||1;
      cnt[name]=(cnt[name]||0)+q;
    });
  });
  const sorted=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const topEl=document.getElementById('top-burgers');
  if(!sorted.length){ topEl.innerHTML='<li class="empty-list">Sin ventas en este período</li>'; }
  else {
    const medals=['🥇','🥈','🥉','4','5','6'];
    topEl.innerHTML=sorted.map(([name,qty],i)=>`
      <li><span class="top-rank">${medals[i]}</span><span class="top-name">${escHtml(name)}</span><span class="top-qty">${qty}</span></li>`).join('');
  }

  // Payment bars
  const pays={Efectivo:0,Transferencia:0,Tarjeta:0};
  activasO.forEach(o=>{ if(pays[o['Metodo_Pago']]!==undefined) pays[o['Metodo_Pago']]++; });
  const totalPays=Object.values(pays).reduce((a,b)=>a+b,0)||1;
  ['efectivo','transferencia','tarjeta'].forEach(k=>{
    const key=k.charAt(0).toUpperCase()+k.slice(1);
    const pct=Math.round((pays[key]/totalPays)*100);
    document.getElementById(`bar-${k}`).style.width=`${pct}%`;
    document.getElementById(`pct-${k}`).textContent=`${pct}%`;
  });

  // Recent (always today)
  const todayStr=today();
  const todayO=state.allOrders.filter(o=>String(o['Fecha']).startsWith(todayStr));
  const recentEl=document.getElementById('recent-orders');
  const recent=[...todayO].reverse().slice(0,12);
  if(!recent.length){ recentEl.innerHTML='<div class="empty-list">Sin órdenes hoy</div>'; }
  else {
    recentEl.innerHTML=recent.map(o=>{
      const rt=relTime(o['Fecha'],o['Hora']);
      const com=o['Comentarios']?`<span class="recent-comment">💬 ${escHtml(o['Comentarios'])}</span>`:'';
      return `<div class="recent-row" data-orden="${o['Num_Orden']}" style="cursor:pointer">
        <span class="recent-num">#${String(o['Num_Orden']||'').padStart(4,'0')}</span>
        <div class="recent-info"><span class="recent-client">${escHtml(o['Cliente']||'Sin nombre')}</span>${com}</div>
        <span class="rel-time ${rt.cls}" data-fecha="${o['Fecha']}" data-hora="${o['Hora']}">${rt.label}</span>
        <span class="recent-total">${fmtMoney(o['Total']||0)}</span>
        <span class="${badgeClass(o['Estado'])}">${o['Estado']||''}</span>
      </div>`;
    }).join('');
    recentEl.querySelectorAll('.recent-row').forEach(row=>row.addEventListener('click',()=>openOrderDetail(row.dataset.orden)));
  }

  // Bar chart by date
  renderDashChart(activasO);
  renderDashInvAlerts();
  renderLiveQueue();
}

export function dashInvPhrase(prefixOne, prefixMany, items){
  const names=items.map(i=>String(i['Nombre']||'').trim()).filter(Boolean);
  if(!names.length) return '';
  if(names.length===1) return `${prefixOne} ${names[0]}`;
  const max=3;
  const shown=names.slice(0,max);
  const extra=names.length-shown.length;
  return `${prefixMany} ${shown.join(', ')}${extra?` y ${extra} más`:''}`;
}

export function cashierDashInv(){
  const gone=[], low=[];
  state.inventory.forEach(i=>{
    const stock=parseFloat(i['Stock'])||0;
    if(state.demoMode && stock<0) return;
    const lvl=invLevel(i);
    if(lvl==='red') gone.push(i);
    else if(lvl==='yellow') low.push(i);
  });
  return {gone, low};
}

export function renderDashInvAlerts(){
  const el=document.getElementById('dash-inv-alert');
  if(!el) return;
  const {gone, low}=cashierDashInv();
  if(!gone.length && !low.length){
    el.hidden=true;
    el.className='dash-inv-strip hidden';
    el.innerHTML='';
    return;
  }
  el.hidden=false;
  el.className='dash-inv-strip '+(gone.length?'crit':'warn');
  const bits=[];
  const acabó=dashInvPhrase('Se acabó','Se acabó:', gone);
  const poco=dashInvPhrase('Queda poco','Queda poco:', low);
  if(acabó) bits.push(`<span class="dash-inv-msg gone">${escHtml(acabó)}</span>`);
  if(poco) bits.push(`<span class="dash-inv-msg low">${escHtml(poco)}</span>`);
  el.innerHTML=`${bits.join('<span class="table-hint">·</span>')}
    <button type="button" class="btn-secondary btn-inline" id="btn-dash-goto-inv">INVENTARIO</button>`;
  document.getElementById('btn-dash-goto-inv')?.addEventListener('click',goToInventarioTab);
}

export function renderDashChart(activasO){
  const chartWrap=document.getElementById('dash-chart');
  if(!chartWrap) return;

  // Accumulate by weekday (0=Sun … 6=Sat), reorder Mon-Sun
  const byWeekday = Array(7).fill(0).map(()=>({total:0, count:0}));
  activasO.forEach(o=>{
    const f = String(o['Fecha']||'');
    if(!f) return;
    const dt = new Date(f+'T12:00:00');
    if(isNaN(dt)) return;
    const wd = dt.getDay(); // 0=Sun
    byWeekday[wd].total += parseFloat(o['Total'])||0;
    byWeekday[wd].count++;
  });

  // Display Mon(1)→Sun(0)
  const ORDER  = [1,2,3,4,5,6,0];
  const LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const COLORS  = ['','','','','#e63232','#e63232','']; // highlight Fri/Sat

  const values = ORDER.map(wd=>byWeekday[wd].total);
  const counts = ORDER.map(wd=>byWeekday[wd].count);
  const maxVal = Math.max(...values)||1;

  if(values.every(v=>v===0)){
    chartWrap.innerHTML='<div class="empty-list">Sin datos para graficar</div>'; return;
  }

  const bars = LABELS.map((label,i)=>{
    const pct  = Math.round((values[i]/maxVal)*100);
    const color= COLORS[i]||'var(--blue-mid)';
    const avg  = counts[i]>0 ? fmtMoney(values[i]/counts[i]) : '—';
    return `<div class="chart-bar-col">
      <div class="chart-bar-label-top">${fmtMoney(values[i])}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar chart-bar-active" style="height:${pct}%;background:${color}"></div>
      </div>
      <div class="chart-bar-day" style="font-size:9px">${label}</div>
      <div class="chart-bar-date" style="color:var(--beige-dark);font-size:9px">${counts[i]} órds · x̄${avg}</div>
    </div>`;
  }).join('');

  chartWrap.innerHTML=`<div class="chart-container">${bars}</div>`;
}
