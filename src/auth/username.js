/** Dominio sintético para Auth (UI solo muestra el usuario). */
export const USERNAME_AUTH_DOMAIN='users.smashiza.local';

const USERNAME_RE=/^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(raw){
  const v=String(raw||'').trim().toLowerCase();
  if(!v) throw new Error('Escribe un usuario.');
  if(v.includes('@')) throw new Error('Usa un usuario, no un correo (sin @).');
  if(!USERNAME_RE.test(v)){
    throw new Error('Usuario: 3–32 caracteres; letras, números, . _ -');
  }
  return v;
}

/** Convierte usuario → email Auth. Si ya trae @, se respeta (login de Lynx). */
export function toAuthEmail(login){
  const raw=String(login||'').trim();
  if(!raw) throw new Error('Escribe usuario o correo.');
  if(raw.includes('@')) return raw.toLowerCase();
  return `${normalizeUsername(raw)}@${USERNAME_AUTH_DOMAIN}`;
}

/** Para mostrar en EQUIPO: quita el dominio sintético. */
export function displayLogin(emailOrUser){
  const raw=String(emailOrUser||'').trim();
  if(!raw) return '';
  const suffix=`@${USERNAME_AUTH_DOMAIN}`;
  if(raw.toLowerCase().endsWith(suffix)) return raw.slice(0, -suffix.length);
  return raw;
}
