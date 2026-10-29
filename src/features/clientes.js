import { state } from '../state.js';
import { fmtMoney, escHtml } from '../utils/format.js';

export function renderClientsTab(){
  const buscar=(document.getElementById('filter-cliente-buscar')?.value||'').trim().toLowerCase();
  const map=new Map();
  state.allOrders.forEach(o=>{
    if(o['Estado']==='Cancelada') return;
    const key=`${(o['Cliente']||'').trim()}||${(o['Direccion']||'').trim()}`;
    if(!map.has(key)) map.set(key,{cliente:(o['Cliente']||'Sin nombre').trim(),direccion:(o['Direccion']||'—').trim(),count:0,total:0,ultimaFecha:''});
    const r=map.get(key);
    r.count++; r.total+=parseFloat(o['Total'])||0;
    if(!r.ultimaFecha||String(o['Fecha'])>r.ultimaFecha) r.ultimaFecha=String(o['Fecha']||'');
  });

  let rows=[...map.values()];
  if(buscar) rows=rows.filter(r=>r.cliente.toLowerCase().includes(buscar)||r.direccion.toLowerCase().includes(buscar));

  // Sort
  const {col,dir}=state.clientsSort;
  rows.sort((a,b)=>{
    let va=a[col],vb=b[col];
    if(typeof va==='string') va=va.toLowerCase(),vb=vb.toLowerCase();
    if(va<vb) return dir==='asc'?-1:1;
    if(va>vb) return dir==='asc'?1:-1;
    return 0;
  });

  const tbody=document.getElementById('clientes-tbody');
  document.getElementById('stat-total-clientes').textContent=map.size;

  // Update header arrows
  document.querySelectorAll('.clients-th[data-col]').forEach(th=>{
    const arrow=th.dataset.col===col?(dir==='asc'?' ▲':' ▼'):'';
    th.querySelector('.th-arrow').textContent=arrow;
  });

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="6" class="empty-list">Sin clientes registrados</td></tr>'; return;
  }
  tbody.innerHTML=rows.map((r,i)=>`
    <tr>
      <td class="col-num" style="color:var(--beige-dark)">${i+1}</td>
      <td><strong style="color:var(--beige)">${escHtml(r.cliente)}</strong></td>
      <td style="color:var(--beige-dark);font-size:11px">${escHtml(r.direccion)}</td>
      <td style="text-align:center">
        <span style="font-family:var(--pixel);font-size:9px;color:var(--yellow)">${r.count}</span>
      </td>
      <td class="col-total">${fmtMoney(r.total)}</td>
      <td style="font-size:11px;color:var(--beige-dark)">${r.ultimaFecha||'—'}</td>
    </tr>`).join('');
}

export function initClientsTab(){
  const inp=document.getElementById('filter-cliente-buscar');
  if(inp) inp.addEventListener('input',renderClientsTab);

  document.querySelectorAll('.clients-th[data-col]').forEach(th=>{
    th.addEventListener('click',()=>{
      const col=th.dataset.col;
      if(state.clientsSort.col===col){
        state.clientsSort.dir=state.clientsSort.dir==='asc'?'desc':'asc';
      } else {
        state.clientsSort.col=col;
        state.clientsSort.dir=col==='cliente'||col==='direccion'?'asc':'desc';
      }
      renderClientsTab();
    });
  });
}
