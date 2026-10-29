export function pad(n)  { return String(n).padStart(2,'0'); }

export function fmtDate(d=new Date()){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

export function fmtTime(d=new Date()){ return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

export function toYmd(v){
  if(v==null||v==='') return '';
  if(v instanceof Date && !isNaN(v)) return fmtDate(v);
  if(typeof v==='number' && isFinite(v)){
    if(v>20000 && v<80000){
      const d=new Date(Math.round((v-25569)*86400*1000));
      return isNaN(d)?'':fmtDate(d);
    }
    return '';
  }
  const s=String(v).trim();
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if(dmy) return `${dmy[3]}-${pad(+dmy[2])}-${pad(+dmy[1])}`;
  const d=new Date(s);
  return isNaN(d)?'':fmtDate(d);
}

export function toHms(v){
  if(v==null||v==='') return '';
  if(typeof v==='number' && isFinite(v) && v>=0 && v<2){
    const secs=Math.round((v%1)*86400);
    return `${pad(Math.floor(secs/3600)%24)}:${pad(Math.floor((secs%3600)/60))}:${pad(secs%60)}`;
  }
  if(v instanceof Date && !isNaN(v)) return fmtTime(v);
  const s=String(v).trim();
  const m=s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(m) return `${pad(+m[1])}:${m[2]}:${m[3]||'00'}`;
  return '';
}

export function fmtMoney(n){ return '$'+String(peso(n)).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

export function peso(n){ return Math.round(Number(n)||0); }

export function parsePesoOptional(v){
  if(v===''||v==null||String(v).trim()==='') return null;
  const n=Number(v); if(!isFinite(n)) return null;
  return Math.round(n);
}

export function today(){ return fmtDate(); }

export function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

export function foldTxt(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
}

export function fmtInvQty(n){
  const x=Number(n); if(!isFinite(x)) return '0';
  return Math.abs(x-Math.round(x))<1e-9 ? String(Math.round(x)) : String(Math.round(x*100)/100);
}

export function normInvName(s){ return String(s||'').trim().replace(/\s+/g,' ').toLowerCase(); }
