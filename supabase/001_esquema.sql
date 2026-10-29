-- La Smashiza POS — esquema inicial.
-- Pegar completo en Supabase → SQL Editor → Run. Es idempotente: se puede volver a correr.
-- Acceso: solo usuarios de Supabase Auth (rol authenticated). El rol anon no ve nada.

-- ── Menú y catálogo ───────────────────────────────────────────
create table if not exists public.categories (
  id         text primary key,
  label      text not null,
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id         text primary key,
  category   text not null,
  emoji      text not null default '',
  name       text not null unique,
  price      numeric(10,2) not null check (price >= 0),
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Todo producto vendido alguna vez, esté o no en el menú actual.
create table if not exists public.catalog (
  name       text primary key,
  emoji      text not null default '',
  category   text not null default '',
  on_menu    boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.product_costs (
  name       text primary key,
  cost       numeric(10,2) not null check (cost >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_history (
  name       text not null,
  since      date not null,
  price      numeric(10,2) not null check (price >= 0),
  primary key (name, since)
);

-- ── Órdenes ───────────────────────────────────────────────────
create table if not exists public.orders (
  num          integer primary key check (num > 0),
  fecha        date not null,
  hora         time not null,
  cliente      text not null default '',
  direccion    text not null default '',
  comentarios  text not null default '',
  metodo_pago  text not null default 'Efectivo',
  ajuste       numeric(10,2) not null default 0,
  total        numeric(10,2) not null default 0,
  recibido     numeric(10,2),
  cambio       numeric(10,2),
  estado       text not null default 'Pendiente',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists orders_fecha_idx on public.orders (fecha);

create table if not exists public.order_items (
  order_num    integer not null references public.orders (num) on delete cascade,
  line         integer not null check (line > 0),
  product_id   text not null default '',
  product      text not null,
  qty          integer not null check (qty > 0),
  unit_price   numeric(10,2) not null check (unit_price >= 0),
  subtotal     numeric(10,2) generated always as (qty * unit_price) stored,
  primary key (order_num, line)
);
create index if not exists order_items_product_idx on public.order_items (product);

-- ── Inventario ────────────────────────────────────────────────
create table if not exists public.inventory (
  name       text primary key,
  unit       text not null default '',
  stock      numeric(12,3) not null default 0,
  minimo     numeric(12,3) not null default 0,
  ideal      numeric(12,3) not null default 0,
  proveedor  text not null default '',
  nota       text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  product    text not null,
  ingredient text not null,
  qty        numeric(12,3) not null check (qty > 0),
  unit       text not null default '',
  primary key (product, ingredient)
);

-- order_num sin FK: el movimiento se conserva aunque la orden se borre.
create table if not exists public.inventory_movements (
  id         bigint generated always as identity primary key,
  fecha      date not null,
  hora       time not null,
  tipo       text not null,
  ingredient text not null,
  qty        numeric(12,3) not null,
  unit       text not null default '',
  order_num  integer,
  nota       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_order_idx on public.inventory_movements (order_num);

-- ── updated_at automático ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories','menu_items','catalog','product_costs','orders','inventory'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ── Vistas para Power BI ──────────────────────────────────────
-- Fecha_Turno: lo vendido antes de las 2:00 cuenta para el día anterior.
create or replace view public.v_orders with (security_invoker = true) as
select o.*,
       case when o.hora < time '02:00' then o.fecha - 1 else o.fecha end as fecha_turno
from public.orders o
where o.deleted_at is null;

create or replace view public.v_order_items with (security_invoker = true) as
select i.*, o.fecha, o.fecha_turno, o.estado, o.metodo_pago
from public.order_items i
join public.v_orders o on o.num = i.order_num;

-- ── Seguridad: RLS + permisos ─────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['categories','menu_items','catalog','product_costs','price_history',
                           'orders','order_items','inventory','recipes','inventory_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated
                    using (true) with check (true)', t);
  end loop;
end $$;

revoke all on public.v_orders, public.v_order_items from anon;
grant select on public.v_orders, public.v_order_items to authenticated;
