-- Smashiza POS — acceso de pago.
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No suspende ni borra La Smashiza.
--
-- Cierra el alta pública (CREAR CUENTA).
-- Solo un dueño de La Smashiza puede:
--   * dar de alta el negocio + usuario del cliente que ya pagó
--   * suspender / reactivar ese negocio
-- Un negocio suspendido no puede guardar ventas, menú, inventario ni caja.
-- La Smashiza (00000000-0000-4000-8000-000000000001) no se puede suspender.

-- ═══════════════════════════════════════════════════════════════
-- 1. Estado de cobro
-- ═══════════════════════════════════════════════════════════════

alter table public.businesses
  add column if not exists suspended boolean not null default false;

alter table public.businesses drop constraint if exists businesses_smashiza_open;
alter table public.businesses
  add constraint businesses_smashiza_open
  check (
    id <> '00000000-0000-4000-8000-000000000001'::uuid
    or suspended = false
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. Quién opera el POS (dueño de La Smashiza)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.user_id = auth.uid()
      and m.business_id = '00000000-0000-4000-8000-000000000001'::uuid
      and m.role = 'owner'
  );
$$;

revoke all on function public.is_platform_operator() from public, anon;
grant execute on function public.is_platform_operator() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. Alta pública cerrada
-- ═══════════════════════════════════════════════════════════════

create or replace function public.register_with_username(
  p_username text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'altas cerradas: pide tu acceso a Smashiza';
end $$;

revoke all on function public.register_with_username(text, text) from public;
grant execute on function public.register_with_username(text, text) to anon, authenticated;

-- Crear negocio propio: solo quien opera Smashiza (un local extra tuyo, no el del cliente).
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
  if not public.is_platform_operator() then
    raise exception 'create_my_business: las altas las abre Smashiza';
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
    color_primary, color_secondary, color_bg, suspended
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
    '#0d0820',
    false
  )
  returning id into v_id;

  insert into public.business_members (user_id, business_id, role)
  values (v_uid, v_id, 'owner');

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

-- ═══════════════════════════════════════════════════════════════
-- 4. list_my_businesses incluye suspended
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
  color_bg text,
  suspended boolean
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
         coalesce(nullif(trim(b.color_bg), ''), '#0d0820'),
         coalesce(b.suspended, false)
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.name;
$$;

revoke all on function public.list_my_businesses() from public, anon;
grant execute on function public.list_my_businesses() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. Alta del cliente que pagó (negocio + dueño, tú no quedas dueño)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.provision_customer_business(
  p_name text,
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_user text;
  v_owner uuid;
  v_slug text;
  v_base text;
  v_id uuid;
  v_n int := 0;
begin
  if auth.uid() is null then
    raise exception 'provision_customer_business: no autenticado';
  end if;
  if not public.is_platform_operator() then
    raise exception 'provision_customer_business: solo Smashiza puede dar acceso';
  end if;
  if v_name = '' then
    raise exception 'provision_customer_business: el nombre es obligatorio';
  end if;

  v_user := public.normalize_username(p_username);
  v_owner := public.create_auth_user_with_username(v_user, p_password);

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
    color_primary, color_secondary, color_bg, suspended
  ) values (
    v_name,
    v_slug,
    v_name,
    '',
    '',
    'Confirma tu pedido por WhatsApp',
    '',
    '#e63232',
    '#1a3bcc',
    '#0d0820',
    false
  )
  returning id into v_id;

  insert into public.business_members (user_id, business_id, role)
  values (v_owner, v_id, 'owner');

  insert into public.categories (business_id, id, label, sort)
  values
    (v_id, 'platillos', 'PLATILLOS', 0),
    (v_id, 'bebidas', 'BEBIDAS', 1),
    (v_id, 'extras', 'EXTRAS', 2)
  on conflict (business_id, id) do nothing;

  return jsonb_build_object(
    'business_id', v_id,
    'username', v_user,
    'name', v_name
  );
end $$;

revoke all on function public.provision_customer_business(text, text, text) from public, anon;
grant execute on function public.provision_customer_business(text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. Lista y suspensión
-- ═══════════════════════════════════════════════════════════════

create or replace function public.list_platform_businesses()
returns table (
  id uuid,
  name text,
  slug text,
  suspended boolean,
  created_at timestamptz,
  owners text,
  member_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'list_platform_businesses: no autenticado';
  end if;
  if not public.is_platform_operator() then
    raise exception 'list_platform_businesses: solo Smashiza';
  end if;

  return query
  select b.id,
         b.name,
         b.slug,
         coalesce(b.suspended, false),
         b.created_at,
         coalesce((
           select string_agg(
             public.display_login_from_email(u.email),
             ', ' order by m.created_at
           )
           from public.business_members m
           join auth.users u on u.id = m.user_id
           where m.business_id = b.id
             and m.role = 'owner'
         ), ''),
         (
           select count(*)
           from public.business_members m
           where m.business_id = b.id
         )
  from public.businesses b
  order by (b.id = '00000000-0000-4000-8000-000000000001'::uuid) desc, b.created_at;
end $$;

revoke all on function public.list_platform_businesses() from public, anon;
grant execute on function public.list_platform_businesses() to authenticated;

create or replace function public.set_business_suspended(
  p_business_id uuid,
  p_suspended boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'set_business_suspended: no autenticado';
  end if;
  if not public.is_platform_operator() then
    raise exception 'set_business_suspended: solo Smashiza';
  end if;
  if p_business_id is null then
    raise exception 'set_business_suspended: business_id requerido';
  end if;
  if p_business_id = '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'set_business_suspended: La Smashiza no se suspende';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'set_business_suspended: negocio no encontrado';
  end if;

  update public.businesses
  set suspended = coalesce(p_suspended, false)
  where id = p_business_id;

  return coalesce(p_suspended, false);
end $$;

revoke all on function public.set_business_suspended(uuid, boolean) from public, anon;
grant execute on function public.set_business_suspended(uuid, boolean) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. Un negocio suspendido no escribe datos
-- ═══════════════════════════════════════════════════════════════

create or replace function public.reject_if_business_suspended()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_bid uuid;
begin
  if tg_op = 'DELETE' then
    v_bid := old.business_id;
  else
    v_bid := new.business_id;
  end if;
  if v_bid is not null and exists (
    select 1 from public.businesses b
    where b.id = v_bid and b.suspended
  ) then
    raise exception 'negocio suspendido: habla con Smashiza para reactivarlo';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories','menu_items','catalog','product_costs','price_history',
    'orders','order_items','inventory','recipes','inventory_movements','cash_shifts'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop trigger if exists reject_if_business_suspended on public.%I', t);
    execute format(
      'create trigger reject_if_business_suspended before insert or update or delete on public.%I for each row execute function public.reject_if_business_suspended()',
      t
    );
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from public.businesses
    where id = '00000000-0000-4000-8000-000000000001'
      and suspended = false
  ) then
    raise exception '014: La Smashiza no está activa';
  end if;
  raise notice 'OK 014 billing gate: altas cerradas; provision_customer_business; suspend; La Smashiza no se suspende';
end $$;
