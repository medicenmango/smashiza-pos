import { fmtDate, fmtTime } from '../utils/format.js';

export function relTime(fecha, hora) {
  if (!fecha||!hora) return {label:'—',cls:'time-ok'};
  const dt = new Date(`${fecha}T${hora}`);
  if (isNaN(dt)) return {label:'—',cls:'time-ok'};
  const mins = Math.round((Date.now()-dt)/60000);
  if (mins<0)  return {label:'ahora',cls:'time-ok'};
  if (mins<15) return {label:`${mins}m`,cls:'time-ok'};
  if (mins<25) return {label:`${mins}m ⚠️`,cls:'time-warn'};
  return {label:`${mins}m 🔴`,cls:'time-late'};
}

export function startClock() {
  const el=document.getElementById('clock');
  const tick=()=>{ const d=new Date(); el.textContent=`${fmtDate(d)}  ${fmtTime(d)}`; };
  tick(); setInterval(tick,1000);
  setInterval(()=>{
    document.querySelectorAll('.rel-time[data-fecha]').forEach(span=>{
      const t=relTime(span.dataset.fecha,span.dataset.hora);
      span.textContent=t.label; span.className=`rel-time ${t.cls}`;
    });
  },30000);
}
