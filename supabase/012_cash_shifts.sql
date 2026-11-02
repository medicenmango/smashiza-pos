-- Smashiza POS — Hito 5: corte de caja (turno).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No borra órdenes.
--
-- Apertura (fondo) → ventas Efectivo/Transferencia/Tarjeta del turno
-- → cierre con esperado vs contado y diferencia.
-- Dueño y cajero pueden abrir/cerrar.

-- ═══════════════════════════════════════════════════════════════
-- 1. Tabla cash_shifts
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.cash_shifts (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  opened_at           timestamptz not null default now(),
  opened_by           uuid references auth.users (id) on delete set null,
  opening_cash        numeric(12,2) not null default 0 check (opening_cash >= 0),
  closed_at           timestamptz,
  closed_by           uuid references auth.users (id) on delete set null,
  sales_efectivo      numeric(12,2),
  sales_transferencia numeric(12,2),
  sales_tarjeta       numeric(12,2),
  expected_cash       numeric(12,2),
  counted_cash        numeric(12,2),
  difference          numeric(12,2),
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists cash_shifts_business_opened_idx
  on public.cash_shifts (business_id, opened_at desc);

-- Un solo turno abierto por negocio
create unique index if not exists cash_shifts_one_open_per_business
  on public.cash_shifts (business_id)
  where closed_at is null;

drop trigger if exists set_updated_at on public.cash_shifts;
create trigger set_updated_at before update on public.cash_shifts
  for each row execute function public.set_updated_at();

alter table public.cash_shifts enable row level security;
revoke all on public.cash_shifts from anon;
grant select, insert, update on public.cash_shifts to authenticated;
-- delete no: historial de cortes se conserva

drop policy if exists cash_shifts_member_select on public.cash_shifts;
create policy cash_shifts_member_select on public.cash_shifts
  for select to authenticated
  using (public.is_business_member(business_id));

drop policy if exists cash_shifts_member_insert on public.cash_shifts;
create policy cash_shifts_member_insert on public.cash_shifts
  for insert to authenticated
  with check (public.is_business_member(business_id));

drop policy if exists cash_shifts_member_update on public.cash_shifts;
create policy cash_shifts_member_update on public.cash_shifts
  for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- ═══════════════════════════════════════════════════════════════
-- 2. Totales de ventas en ventana (no muta órdenes)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.cash_shift_sales_totals(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  sales_efectivo numeric,
  sales_transferencia numeric,
  sales_tarjeta numeric,
  order_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(case when o.metodo_pago = 'Efectivo' then o.total else 0 end), 0),
    coalesce(sum(case when o.metodo_pago = 'Transferencia' then o.total else 0 end), 0),
    coalesce(sum(case when o.metodo_pago = 'Tarjeta' then o.total else 0 end), 0),
    count(*)::bigint
  from public.orders o
  where o.business_id = p_business_id
    and o.deleted_at is null
    and o.estado is distinct from 'Cancelada'
    and (o.fecha + coalesce(o.hora, time '00:00')) >= p_from
    and (o.fecha + coalesce(o.hora, time '00:00')) < coalesce(p_to, now());
$$;

revoke all on function public.cash_shift_sales_totals(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.cash_shift_sales_totals(uuid, timestamptz, timestamptz) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. RPCs abrir / leer abierto / cerrar / listar recientes
-- ═══════════════════════════════════════════════════════════════

create or replace function public.open_cash_shift(
  p_business_id uuid,
  p_opening_cash numeric default 0
)
returns public.cash_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cash_shifts;
  v_cash numeric(12,2) := coalesce(p_opening_cash, 0);
begin
  if auth.uid() is null then
    raise exception 'open_cash_shift: no autenticado';
  end if;
  if p_business_id is null then
    raise exception 'open_cash_shift: business_id requerido';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'open_cash_shift: sin membresía';
  end if;
  if v_cash < 0 then
    raise exception 'open_cash_shift: el fondo no puede ser negativo';
  end if;
  if exists (
    select 1 from public.cash_shifts s
    where s.business_id = p_business_id and s.closed_at is null
  ) then
    raise exception 'open_cash_shift: ya hay un turno abierto';
  end if;

  insert into public.cash_shifts (business_id, opened_by, opening_cash)
  values (p_business_id, auth.uid(), v_cash)
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.open_cash_shift(uuid, numeric) from public, anon;
grant execute on function public.open_cash_shift(uuid, numeric) to authenticated;

create or replace function public.get_open_cash_shift(p_business_id uuid)
returns setof public.cash_shifts
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'get_open_cash_shift: no autenticado';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'get_open_cash_shift: sin membresía';
  end if;

  return query
  select s.*
  from public.cash_shifts s
  where s.business_id = p_business_id and s.closed_at is null
  order by s.opened_at desc
  limit 1;
end $$;

revoke all on function public.get_open_cash_shift(uuid) from public, anon;
grant execute on function public.get_open_cash_shift(uuid) to authenticated;

-- Cierre: la app manda totales del turno (Fecha+Hora local de órdenes).
-- Si algún total viene null, se recalcula en servidor (fecha+hora ≈ sesión DB).
create or replace function public.close_cash_shift(
  p_business_id uuid,
  p_counted_cash numeric,
  p_sales_efectivo numeric default null,
  p_sales_transferencia numeric default null,
  p_sales_tarjeta numeric default null,
  p_notes text default ''
)
returns public.cash_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cash_shifts;
  v_sales record;
  v_counted numeric(12,2) := coalesce(p_counted_cash, 0);
  v_ef numeric(12,2);
  v_tr numeric(12,2);
  v_tj numeric(12,2);
  v_expected numeric(12,2);
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'close_cash_shift: no autenticado';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'close_cash_shift: sin membresía';
  end if;
  if v_counted < 0 then
    raise exception 'close_cash_shift: el contado no puede ser negativo';
  end if;

  select * into v_row
  from public.cash_shifts s
  where s.business_id = p_business_id and s.closed_at is null
  for update;

  if v_row.id is null then
    raise exception 'close_cash_shift: no hay turno abierto';
  end if;

  if p_sales_efectivo is null
     or p_sales_transferencia is null
     or p_sales_tarjeta is null then
    select * into v_sales
    from public.cash_shift_sales_totals(p_business_id, v_row.opened_at, v_now);
    v_ef := coalesce(p_sales_efectivo, v_sales.sales_efectivo, 0);
    v_tr := coalesce(p_sales_transferencia, v_sales.sales_transferencia, 0);
    v_tj := coalesce(p_sales_tarjeta, v_sales.sales_tarjeta, 0);
  else
    v_ef := greatest(0, p_sales_efectivo);
    v_tr := greatest(0, p_sales_transferencia);
    v_tj := greatest(0, p_sales_tarjeta);
  end if;

  v_expected := coalesce(v_row.opening_cash, 0) + v_ef;

  update public.cash_shifts s
     set closed_at = v_now,
         closed_by = auth.uid(),
         sales_efectivo = v_ef,
         sales_transferencia = v_tr,
         sales_tarjeta = v_tj,
         expected_cash = v_expected,
         counted_cash = v_counted,
         difference = v_counted - v_expected,
         notes = coalesce(p_notes, '')
   where s.id = v_row.id
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.close_cash_shift(uuid, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.close_cash_shift(uuid, numeric, numeric, numeric, numeric, text) to authenticated;

drop function if exists public.list_cash_shifts(uuid, integer);
create function public.list_cash_shifts(
  p_business_id uuid,
  p_limit integer default 10
)
returns setof public.cash_shifts
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'list_cash_shifts: no autenticado';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'list_cash_shifts: sin membresía';
  end if;

  return query
  select s.*
  from public.cash_shifts s
  where s.business_id = p_business_id
  order by s.opened_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end $$;

revoke all on function public.list_cash_shifts(uuid, integer) from public, anon;
grant execute on function public.list_cash_shifts(uuid, integer) to authenticated;

do $$
begin
  raise notice 'OK 012 cash_shifts: open/close turno; ventas por método; sin borrar órdenes';
end $$;
