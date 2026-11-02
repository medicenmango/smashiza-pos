-- Smashiza POS — colores por negocio (tema CSS).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No borra datos. Smashiza recibe paleta retro si aún no tiene colores.

-- ═══════════════════════════════════════════════════════════════
-- 1. Columnas
-- ═══════════════════════════════════════════════════════════════

alter table public.businesses add column if not exists color_primary text;
alter table public.businesses add column if not exists color_secondary text;
alter table public.businesses add column if not exists color_bg text;

-- Backfill solo celdas vacías → paleta retro (no pisa colores ya guardados)
update public.businesses
set color_primary = '#e63232'
where color_primary is null or trim(color_primary) = '';

update public.businesses
set color_secondary = '#1a3bcc'
where color_secondary is null or trim(color_secondary) = '';

update public.businesses
set color_bg = '#0d0820'
where color_bg is null or trim(color_bg) = '';

-- ═══════════════════════════════════════════════════════════════
-- 2. list_my_businesses + colores
-- ═══════════════════════════════════════════════════════════════

drop function if exists public.list_my_businesses();

create function public.list_my_businesses()
returns table (
  id uuid,
  name text,
  slug text,
  role text,
  ticket_name text,
  ticket_tagline text,
  phone text,
  ticket_footer text,
  logo_path text,
  color_primary text,
  color_secondary text,
  color_bg text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.slug, m.role,
         coalesce(nullif(trim(b.ticket_name), ''), b.name),
         coalesce(b.ticket_tagline, ''),
         coalesce(b.phone, ''),
         coalesce(nullif(trim(b.ticket_footer), ''), 'Confirma tu pedido por WhatsApp'),
         coalesce(b.logo_path, ''),
         coalesce(nullif(trim(b.color_primary), ''), '#e63232'),
         coalesce(nullif(trim(b.color_secondary), ''), '#1a3bcc'),
         coalesce(nullif(trim(b.color_bg), ''), '#0d0820')
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.name;
$$;

revoke all on function public.list_my_businesses() from public, anon;
grant execute on function public.list_my_businesses() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. RPC: actualizar tema (solo owner)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.update_my_business_theme(
  p_business_id uuid,
  p_color_primary text,
  p_color_secondary text,
  p_color_bg text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p text := lower(trim(coalesce(p_color_primary, '')));
  v_s text := lower(trim(coalesce(p_color_secondary, '')));
  v_b text := lower(trim(coalesce(p_color_bg, '')));
begin
  if auth.uid() is null then
    raise exception 'update_my_business_theme: no autenticado';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'update_my_business_theme: solo el dueño puede editar colores';
  end if;
  if v_p !~ '^#[0-9a-f]{6}$' or v_s !~ '^#[0-9a-f]{6}$' or v_b !~ '^#[0-9a-f]{6}$' then
    raise exception 'update_my_business_theme: usa colores hex #rrggbb';
  end if;

  update public.businesses
  set color_primary = v_p,
      color_secondary = v_s,
      color_bg = v_b
  where id = p_business_id;
end $$;

revoke all on function public.update_my_business_theme(uuid, text, text, text) from public, anon;
grant execute on function public.update_my_business_theme(uuid, text, text, text) to authenticated;

-- Nuevos negocios: defaults retro en create_my_business (redefinir con mismos args)
create or replace function public.create_my_business(
  p_name text,
  p_ticket_name text default null,
  p_ticket_tagline text default null,
  p_phone text default null,
  p_ticket_footer text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_base text;
  v_id uuid;
  v_n int := 0;
begin
  if v_uid is null then
    raise exception 'create_my_business: no autenticado';
  end if;
  if v_name = '' then
    raise exception 'create_my_business: el nombre es obligatorio';
  end if;

  v_base := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'negocio'; end if;
  v_slug := v_base;

  while exists (select 1 from public.businesses b where b.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  insert into public.businesses (
    name, slug, ticket_name, ticket_tagline, phone, ticket_footer, logo_path,
    color_primary, color_secondary, color_bg
  ) values (
    v_name,
    v_slug,
    coalesce(nullif(trim(coalesce(p_ticket_name, '')), ''), v_name),
    coalesce(p_ticket_tagline, ''),
    coalesce(p_phone, ''),
    coalesce(nullif(trim(coalesce(p_ticket_footer, '')), ''), 'Confirma tu pedido por WhatsApp'),
    '',
    '#e63232',
    '#1a3bcc',
    '#0d0820'
  )
  returning id into v_id;

  insert into public.business_members (user_id, business_id, role)
  values (v_uid, v_id, 'owner');

  return v_id;
end $$;

revoke all on function public.create_my_business(text, text, text, text, text) from public, anon;
grant execute on function public.create_my_business(text, text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. Verificación
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  smashiza uuid := '00000000-0000-4000-8000-000000000001';
  cp text;
begin
  select color_primary into cp from public.businesses where id = smashiza;
  if lower(cp) is distinct from '#e63232' then
    raise exception 'Smashiza color_primary esperado #e63232, got %', cp;
  end if;
  raise notice 'OK theme colors: Smashiza primary=%, RPC update_my_business_theme listo', cp;
end $$;
