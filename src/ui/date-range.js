import { state } from '../state.js';
import { pad, fmtDate, today } from '../utils/format.js';

/** Estado de rango de fechas (start/end YYYY-MM-DD; null = todo). */
export function createDateRange(initialToday=true){
  const t=today();
  return {
    start:initialToday?t:null,
    end:initialToday?t:null,
    hovering:null,
    picking:false,
    _viewYear:new Date().getFullYear(),
    _viewMonth:new Date().getMonth(),
  };
}

export function rangeLabelText(range){
  if(!range?.start) return 'Todo el historial';
  if(!range.end||range.start===range.end) return range.start;
  return `${range.start} → ${range.end}`;
}

export function filterByDateRange(orders, range){
  if(!range?.start) return orders;
  const s=range.start;
  const e=range.end||range.start;
  return orders.filter(o=>{
    const f=String(o['Fecha']||'');
    return f>=s && f<=e;
  });
}

export function buildMonthHtml(year, month, range){
  const MONTH_NAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAY_NAMES=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
  const datesWithOrders=new Set(state.allOrders.map(o=>String(o['Fecha'])));
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const hover=range.hovering;
  const rangeEnd=range.picking&&hover?(hover>range.start?hover:range.start):range.end;
  const rangeStart=range.picking&&hover&&hover<range.start?hover:range.start;

  let html=`
    <div class="cal-month-title">${MONTH_NAMES[month]} ${year}</div>
    <div class="cal-grid">
      ${DAY_NAMES.map(d=>`<div class="cal-header-day">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div class="cal-day cal-empty"></div>').join('')}`;

  for(let day=1;day<=daysInMonth;day++){
    const dateStr=`${year}-${pad(month+1)}-${pad(day)}`;
    const isStart=dateStr===range.start;
    const isEnd=dateStr===range.end||(range.picking&&dateStr===hover);
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

/**
 * Conecta el panel HOY / 7 DÍAS / ESTE MES / TODO + calendario.
 * ids: { label, hoy, semana, mes, todo, toggle, collapse, prev, next, months, left, right }
 */
export function bindDateRangeFilter({ range, ids, onChange }){
  const el=id=>document.getElementById(id);
  const label=()=>el(ids.label);
  const toggleBtn=()=>el(ids.toggle);
  const calWrap=()=>el(ids.collapse);

  function setCalOpen(open){
    const wrap=calWrap();
    const btn=toggleBtn();
    if(wrap) wrap.classList.toggle('hidden', !open);
    if(btn) btn.textContent=open?'📅 OCULTAR CALENDARIO ▲':'📅 SELECCIONAR FECHAS ▼';
  }

  function rebuildMonths(){
    const yr=range._viewYear||new Date().getFullYear();
    const mo=range._viewMonth||0;
    const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;
    const left=el(ids.left), right=el(ids.right), lab=label();
    if(left) left.innerHTML=buildMonthHtml(yr, mo, range);
    if(right) right.innerHTML=buildMonthHtml(yr2, mo2, range);
    if(lab) lab.textContent=rangeLabelText(range);
  }

  function renderPicker(){
    rebuildMonths();
    const yr=range._viewYear||new Date().getFullYear();
    const mo=range._viewMonth||0;
    const mo2=mo===11?0:mo+1, yr2=mo===11?yr+1:yr;
    const left=el(ids.left), right=el(ids.right);
    if(left) left.innerHTML=buildMonthHtml(yr, mo, range);
    if(right) right.innerHTML=buildMonthHtml(yr2, mo2, range);
    const lab=label();
    if(lab) lab.textContent=rangeLabelText(range);

    const calMonths=el(ids.months);
    if(!calMonths) return;
    const fresh=calMonths.cloneNode(true);
    calMonths.replaceWith(fresh);
    fresh.id=ids.months;

    fresh.addEventListener('click', e=>{
      const dayEl=e.target.closest('.cal-day[data-date]');
      if(!dayEl) return;
      const d=dayEl.dataset.date;
      if(!range.picking){
        range.start=d; range.end=null;
        range.picking=true; range.hovering=null;
      } else {
        if(d<range.start){ range.end=range.start; range.start=d; }
        else range.end=d;
        range.picking=false; range.hovering=null;
        setCalOpen(false);
        onChange?.();
      }
      rebuildMonths();
    });
    fresh.addEventListener('mouseover', e=>{
      if(!range.picking) return;
      const dayEl=e.target.closest('.cal-day[data-date]');
      if(!dayEl) return;
      if(range.hovering===dayEl.dataset.date) return;
      range.hovering=dayEl.dataset.date;
      rebuildMonths();
    });
    fresh.addEventListener('mouseleave', ()=>{
      if(!range.picking||!range.hovering) return;
      range.hovering=null;
      rebuildMonths();
    });
  }

  setCalOpen(false);
  el(ids.toggle)?.addEventListener('click', ()=>{
    const wrap=calWrap();
    setCalOpen(!!wrap?.classList.contains('hidden'));
  });
  el(ids.hoy)?.addEventListener('click', ()=>{
    range.start=today(); range.end=today(); range.picking=false;
    renderPicker(); setCalOpen(false); onChange?.();
  });
  el(ids.semana)?.addEventListener('click', ()=>{
    const d=new Date(); d.setDate(d.getDate()-6);
    range.start=fmtDate(d); range.end=today(); range.picking=false;
    renderPicker(); setCalOpen(false); onChange?.();
  });
  el(ids.mes)?.addEventListener('click', ()=>{
    const d=new Date(); d.setDate(1);
    range.start=fmtDate(d); range.end=today(); range.picking=false;
    renderPicker(); setCalOpen(false); onChange?.();
  });
  el(ids.todo)?.addEventListener('click', ()=>{
    range.start=null; range.end=null; range.picking=false;
    renderPicker(); setCalOpen(false); onChange?.();
  });
  el(ids.prev)?.addEventListener('click', ()=>{
    range._viewMonth--;
    if(range._viewMonth<0){ range._viewMonth=11; range._viewYear--; }
    rebuildMonths();
  });
  el(ids.next)?.addEventListener('click', ()=>{
    range._viewMonth++;
    if(range._viewMonth>11){ range._viewMonth=0; range._viewYear++; }
    rebuildMonths();
  });

  renderPicker();
  return { renderPicker, rebuildMonths, setCalOpen };
}
