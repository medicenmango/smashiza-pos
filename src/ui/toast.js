export function toast(msg, type='success', ms=3000) {
  const c=document.getElementById('toast-container');
  const el=document.createElement('div');
  el.className=`toast ${type}`; el.textContent=msg; c.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)';
    el.style.transition='all .3s'; setTimeout(()=>el.remove(),350); },ms);
}
