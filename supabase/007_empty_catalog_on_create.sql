-- Smashiza POS — Hito 3: catálogo vacío / plantilla genérica al crear negocio.
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No toca el menú ni datos de La Smashiza.
--
-- create_my_business ahora siembra solo categorías genéricas
-- (platillos / bebidas / extras) SIN productos Smashiza.

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

  -- Plantilla genérica: solo categorías vacías (sin menu_items / sin burgers Smashiza)
  insert into public.categories (business_id, id, label, sort)
  values
    (v_id, 'platillos', 'PLATILLOS', 0),
    (v_id, 'bebidas', 'BEBIDAS', 1),
    (v_id, 'extras', 'EXTRAS', 2)
  on conflict (business_id, id) do nothing;

  return v_id;
end $$;

revoke all on function public.create_my_business(text, text, text, text, text) from public, anon;
grant execute on function public.create_my_business(text, text, text, text, text) to authenticated;

do $$
begin
  raise notice 'OK empty catalog: create_my_business siembra platillos/bebidas/extras sin productos';
end $$;
