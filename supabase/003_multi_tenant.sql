-- Smashiza POS — Hito 1: multi-tenant + RLS por membresía.
-- Pegar completo en Supabase → SQL Editor → Run (una sola vez en producción).
-- Preserva datos existentes: todo se asigna al negocio "La Smashiza".
-- Idempotente en lo razonable: se puede re-ejecutar si falló a medias (ver runbook).

-- UUID fijo del tenant #1 (La Smashiza). No cambiar una vez corrido en prod.
-- 00000000-0000-4000-8000-000000000001

-- ═══════════════════════════════════════════════════════════════
-- 1. Negocios y membresías
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.businesses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  user_id     uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role        text not null default 'owner'
              check (role in ('owner', 'cashier', 'kitchen')),
  created_at  timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index if not exists business_members_business_idx
  on public.business_members (business_id);

drop trigger if exists set_updated_at on public.businesses;
create trigger set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- Seed La Smashiza (tenant #1)
insert into public.businesses (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'La Smashiza', 'la-smashiza')
on conflict (id) do update set name = excluded.name, slug = excluded.slug;

-- Lynx (único usuario Auth hoy) → owner de La Smashiza.
-- Si hay más de un usuario en auth.users, TODOS quedan como owner del seed;
-- revisa Auth antes de correr (ver runbook).
insert into public.business_members (user_id, business_id, role)
select u.id, '00000000-0000-4000-8000-000000000001'::uuid, 'owner'
from auth.users u
on conflict (user_id, business_id) do update set role = excluded.role;

-- ═══════════════════════════════════════════════════════════════
-- 2. Helpers RLS (security definer: evitan recursión en policies)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_business_id is not null
     and exists (
       select 1
       from public.business_members m
       where m.business_id = p_business_id
         and m.user_id = auth.uid()
     );
$$;

create or replace function public.my_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = auth.uid();
$$;

revoke all on function public.is_business_member(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;
revoke all on function public.my_business_ids() from public, anon;
grant execute on function public.my_business_ids() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. Añadir business_id a tablas de datos + backfill
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  t text;
  smashiza uuid := '00000000-0000-4000-8000-000000000001';
begin
  foreach t in array array[
    'categories','menu_items','catalog','product_costs','price_history',
    'orders','order_items','inventory','recipes','inventory_movements'
  ] loop
    execute format(
      'alter table public.%I add column if not exists business_id uuid references public.businesses (id)',
      t
    );
    execute format(
      'update public.%I set business_id = $1 where business_id is null',
      t
    ) using smashiza;
  end loop;
end $$;

-- order_items: alinear business_id con la orden padre por si quedó desfasado
update public.order_items i
set business_id = o.business_id
from public.orders o
where i.order_num = o.num
  and (i.business_id is distinct from o.business_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. PKs / FKs / índices compuestos por negocio
-- ═══════════════════════════════════════════════════════════════

-- Helper: recrear PK solo si aún no es exactamente esa lista de columnas
create or replace function public._mt_set_pkey(p_table text, p_cols text[])
returns void language plpgsql set search_path = '' as $$
declare
  cur text[];
  ddl text;
begin
  select array_agg(a.attname::text order by u.ord)
    into cur
  from pg_index i
  join unnest(i.indkey) with ordinality as u(attnum, ord) on true
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = u.attnum
  where i.indrelid = ('public.' || p_table)::regclass and i.indisprimary;

  if cur is not null and cur = p_cols then
    return;
  end if;

  execute format('alter table public.%I drop constraint if exists %I', p_table, p_table || '_pkey');
  ddl := format('alter table public.%I add primary key (%s)',
                p_table, array_to_string(array(select format('%I', c) from unnest(p_cols) c), ', '));
  execute ddl;
end $$;

-- orders ↔ order_items
alter table public.order_items drop constraint if exists order_items_order_num_fkey;
alter table public.order_items drop constraint if exists order_items_order_fkey;

alter table public.orders alter column business_id set not null;
alter table public.order_items alter column business_id set not null;

do $$
begin
  perform public._mt_set_pkey('orders', array['business_id','num']);
  perform public._mt_set_pkey('order_items', array['business_id','order_num','line']);
end $$;

alter table public.order_items drop constraint if exists order_items_order_fkey;
alter table public.order_items
  add constraint order_items_order_fkey
  foreign key (business_id, order_num)
  references public.orders (business_id, num)
  on delete cascade;

drop index if exists orders_client_id_key;
create unique index if not exists orders_business_client_id_key
  on public.orders (business_id, client_id)
  where client_id is not null;

drop index if exists orders_fecha_idx;
create index if not exists orders_business_fecha_idx
  on public.orders (business_id, fecha);

-- Resto de tablas: NOT NULL y luego PK compuesta (mismo id/nombre puede existir en 2 negocios)
alter table public.categories alter column business_id set not null;
alter table public.menu_items alter column business_id set not null;
alter table public.catalog alter column business_id set not null;
alter table public.product_costs alter column business_id set not null;
alter table public.price_history alter column business_id set not null;
alter table public.inventory alter column business_id set not null;
alter table public.recipes alter column business_id set not null;

do $$
begin
  perform public._mt_set_pkey('categories', array['business_id','id']);
  perform public._mt_set_pkey('menu_items', array['business_id','id']);
  perform public._mt_set_pkey('catalog', array['business_id','name']);
  perform public._mt_set_pkey('product_costs', array['business_id','name']);
  perform public._mt_set_pkey('price_history', array['business_id','name','since']);
  perform public._mt_set_pkey('inventory', array['business_id','name']);
  perform public._mt_set_pkey('recipes', array['business_id','product','ingredient']);
end $$;

drop function if exists public._mt_set_pkey(text, text[]);

-- inventory_movements (PK identity se conserva; business_id NOT NULL + índice)
alter table public.inventory_movements alter column business_id set not null;
drop index if exists inventory_movements_client_id_key;
create unique index if not exists inventory_movements_business_client_id_key
  on public.inventory_movements (business_id, client_id)
  where client_id is not null;
drop index if exists inventory_movements_order_idx;
create index if not exists inventory_movements_business_order_idx
  on public.inventory_movements (business_id, order_num);
create index if not exists inventory_movements_business_idx
  on public.inventory_movements (business_id, id);

-- ═══════════════════════════════════════════════════════════════
-- 5. RLS: reemplazar staff_all (using true) por membresía
-- ═══════════════════════════════════════════════════════════════

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

revoke all on public.businesses from anon;
revoke all on public.business_members from anon;
grant select on public.businesses to authenticated;
grant select on public.business_members to authenticated;
-- insert/update de negocios se hará en hitos posteriores (onboarding);
-- por ahora solo lectura de lo que eres miembro.

drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses
  for select to authenticated
  using (public.is_business_member(id));

drop policy if exists business_members_select_own on public.business_members;
create policy business_members_select_own on public.business_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id));

do $$
declare t text;
begin
  foreach t in array array[
    'categories','menu_items','catalog','product_costs','price_history',
    'orders','order_items','inventory','recipes','inventory_movements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('drop policy if exists member_all on public.%I', t);
    execute format(
      'create policy member_all on public.%I for all to authenticated
         using (public.is_business_member(business_id))
         with check (public.is_business_member(business_id))',
      t
    );
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 6. Vistas Power BI (security_invoker → RLS aplica)
-- ═══════════════════════════════════════════════════════════════

create or replace view public.v_orders with (security_invoker = true) as
select o.*,
       case when o.hora < time '02:00' then o.fecha - 1 else o.fecha end as fecha_turno
from public.orders o
where o.deleted_at is null;

create or replace view public.v_order_items with (security_invoker = true) as
select i.*, o.fecha, o.fecha_turno, o.estado, o.metodo_pago, o.business_id as order_business_id
from public.order_items i
join public.v_orders o
  on o.num = i.order_num
 and o.business_id = i.business_id;

revoke all on public.v_orders, public.v_order_items from anon;
grant select on public.v_orders, public.v_order_items to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. Triggers y RPCs con business_id
-- ═══════════════════════════════════════════════════════════════

-- Stock: movimiento aplica solo al inventario del mismo negocio
create or replace function public.apply_movement()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.inventory
     set stock = stock + new.qty
   where name = new.ingredient
     and business_id = new.business_id;
  return new;
end $$;

drop trigger if exists apply_movement on public.inventory_movements;
create trigger apply_movement after insert on public.inventory_movements
  for each row execute function public.apply_movement();

-- save_order: números de orden y client_id scoped al negocio
create or replace function public.save_order(p_order jsonb, p_items jsonb, p_is_new boolean default false)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_num   integer := (p_order->>'num')::integer;
  v_cid   uuid    := nullif(p_order->>'client_id', '')::uuid;
  v_bid   uuid    := nullif(p_order->>'business_id', '')::uuid;
  v_found integer;
begin
  if v_bid is null then
    raise exception 'save_order: business_id es obligatorio';
  end if;
  if not public.is_business_member(v_bid) then
    raise exception 'save_order: sin membresía en el negocio';
  end if;

  if p_is_new then
    perform pg_advisory_xact_lock(hashtext('smashiza_orders_num_' || v_bid::text));
  end if;

  if v_cid is not null then
    select num into v_found
      from public.orders
     where business_id = v_bid and client_id = v_cid;
  end if;

  if v_found is not null then
    v_num := v_found;
  elsif p_is_new and exists (
    select 1 from public.orders where business_id = v_bid and num = v_num
  ) then
    select coalesce(max(num), 0) + 1 into v_num
      from public.orders
     where business_id = v_bid;
  end if;

  insert into public.orders as o (
    business_id, num, fecha, hora, cliente, direccion, comentarios, metodo_pago,
    ajuste, total, recibido, cambio, estado, client_id
  )
  select v_bid, v_num, r.fecha, r.hora, coalesce(r.cliente, ''), coalesce(r.direccion, ''),
         coalesce(r.comentarios, ''), coalesce(r.metodo_pago, 'Efectivo'),
         coalesce(r.ajuste, 0), coalesce(r.total, 0), r.recibido, r.cambio,
         coalesce(r.estado, 'Pendiente'), v_cid
  from jsonb_populate_record(null::public.orders, p_order) r
  on conflict (business_id, num) do update set
    fecha = excluded.fecha, hora = excluded.hora, cliente = excluded.cliente,
    direccion = excluded.direccion, comentarios = excluded.comentarios,
    metodo_pago = excluded.metodo_pago, ajuste = excluded.ajuste, total = excluded.total,
    recibido = excluded.recibido, cambio = excluded.cambio, estado = excluded.estado,
    client_id = coalesce(o.client_id, excluded.client_id);

  delete from public.order_items
   where business_id = v_bid and order_num = v_num;

  insert into public.order_items (business_id, order_num, line, product_id, product, qty, unit_price)
  select v_bid, v_num, r.line, coalesce(r.product_id, ''), r.product, r.qty, r.unit_price
  from jsonb_populate_recordset(null::public.order_items, p_items) r;

  return v_num;
end $$;

revoke all on function public.save_order(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_order(jsonb, jsonb, boolean) to authenticated;
revoke all on function public.apply_movement() from public, anon;

-- RPC de conveniencia: negocios del usuario autenticado
create or replace function public.list_my_businesses()
returns table (
  id uuid,
  name text,
  slug text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.slug, m.role
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.name;
$$;

revoke all on function public.list_my_businesses() from public, anon;
grant execute on function public.list_my_businesses() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 8. Verificación rápida (resultado en Notices / Messages)
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  smashiza uuid := '00000000-0000-4000-8000-000000000001';
  n_biz int;
  n_mem int;
  n_ord int;
  n_null int := 0;
  t text;
begin
  select count(*) into n_biz from public.businesses where id = smashiza;
  select count(*) into n_mem from public.business_members where business_id = smashiza;
  select count(*) into n_ord from public.orders where business_id = smashiza;

  foreach t in array array[
    'categories','menu_items','catalog','product_costs','price_history',
    'orders','order_items','inventory','recipes','inventory_movements'
  ] loop
    execute format('select count(*) from public.%I where business_id is null', t) into n_null;
    if n_null > 0 then
      raise exception 'Filas sin business_id en %: %', t, n_null;
    end if;
  end loop;

  raise notice 'OK multi-tenant: La Smashiza=% (esperado 1), members=%, orders_smashiza=%',
    n_biz, n_mem, n_ord;
  if n_mem < 1 then
    raise warning 'Ningún auth.users quedó como member. Crea tu usuario Auth y re-inserta membresía (ver runbook).';
  end if;
end $$;
