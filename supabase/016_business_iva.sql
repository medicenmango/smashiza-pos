-- Smashiza POS — IVA por negocio.
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No borra órdenes ni cambia totales ya cobrados.
-- La Smashiza y cualquier negocio nuevo quedan en 0% (no se fuerza 16%).
-- El total guardado es lo que paga el cliente: base (subtotal + ajuste) + IVA.
-- Una orden ya cobrada conserva su tasa aunque el negocio la cambie después.

alter table public.businesses
  add column if not exists iva_rate numeric(5,2) not null default 0;

update public.businesses
set iva_rate = 0
where iva_rate is null
   or id = '00000000-0000-4000-8000-000000000001';

alter table public.businesses drop constraint if exists businesses_iva_rate_chk;
alter table public.businesses
  add constraint businesses_iva_rate_chk
  check (iva_rate >= 0 and iva_rate <= 100);

alter table public.orders
  add column if not exists iva_rate numeric(5,2) not null default 0;

alter table public.orders
  add column if not exists iva_amount numeric(10,2) not null default 0;

-- list_my_businesses: mismas columnas que el 015 + iva_rate.
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
  suspended boolean,
  font_family text,
  font_color text,
  iva_rate numeric
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
         coalesce(b.suspended, false),
         case
           when b.font_family in ('retro', 'sans', 'rounded') then b.font_family
           else 'retro'
         end,
         coalesce(nullif(lower(trim(b.font_color)), ''), '#ffd700'),
         coalesce(b.iva_rate, 0)
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.name;
$$;

revoke all on function public.list_my_businesses() from public, anon;
grant execute on function public.list_my_businesses() to authenticated;

create or replace function public.update_my_business_iva(
  p_business_id uuid,
  p_iva_rate numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric := round(coalesce(p_iva_rate, -1), 2);
begin
  if auth.uid() is null then
    raise exception 'update_my_business_iva: no autenticado';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'update_my_business_iva: solo el dueño puede cambiar el IVA';
  end if;
  if v_rate < 0 or v_rate > 100 then
    raise exception 'update_my_business_iva: la tasa va de 0 a 100';
  end if;

  update public.businesses
  set iva_rate = v_rate
  where id = p_business_id;
end $$;

revoke all on function public.update_my_business_iva(uuid, numeric) from public, anon;
grant execute on function public.update_my_business_iva(uuid, numeric) to authenticated;

-- save_order: misma numeración del 004. El total se recalcula como base + IVA.
-- Alta nueva: tasa actual del negocio. Edición o reintento: tasa ya guardada en la orden.
create or replace function public.save_order(p_order jsonb, p_items jsonb, p_is_new boolean default false)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_num    integer := (p_order->>'num')::integer;
  v_cid    uuid    := nullif(p_order->>'client_id', '')::uuid;
  v_bid    uuid    := nullif(p_order->>'business_id', '')::uuid;
  v_found  integer;
  v_sum    numeric := 0;
  v_ajuste numeric := 0;
  v_rate   numeric := 0;
  v_stored numeric;
  v_base   integer := 0;
  v_iva    integer := 0;
  v_total  integer := 0;
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
  elsif p_is_new then
    select coalesce(max(num), 0) + 1 into v_num
      from public.orders
     where business_id = v_bid;
  end if;

  if v_num is null or v_num <= 0 then
    raise exception 'save_order: num inválido';
  end if;

  select coalesce(sum(r.qty * r.unit_price), 0) into v_sum
    from jsonb_populate_recordset(null::public.order_items, coalesce(p_items, '[]'::jsonb)) r;

  v_ajuste := coalesce((p_order->>'ajuste')::numeric, 0);

  v_stored := null;
  if v_found is not null or not p_is_new then
    select o.iva_rate into v_stored
      from public.orders o
     where o.business_id = v_bid and o.num = v_num;
  end if;

  if v_stored is null then
    select coalesce(b.iva_rate, 0) into v_rate
      from public.businesses b
     where b.id = v_bid;
  else
    v_rate := v_stored;
  end if;

  v_rate := round(coalesce(v_rate, 0), 2);
  if v_rate < 0 then v_rate := 0; end if;
  if v_rate > 100 then v_rate := 100; end if;

  v_base := round(greatest(0, v_sum + v_ajuste))::integer;
  v_iva := round((v_base * v_rate) / 100.0)::integer;
  v_total := v_base + v_iva;

  insert into public.orders as o (
    business_id, num, fecha, hora, cliente, direccion, comentarios, metodo_pago,
    ajuste, total, iva_rate, iva_amount, recibido, cambio, estado, client_id
  )
  select v_bid, v_num, r.fecha, r.hora, coalesce(r.cliente, ''), coalesce(r.direccion, ''),
         coalesce(r.comentarios, ''), coalesce(r.metodo_pago, 'Efectivo'),
         v_ajuste, v_total, v_rate, v_iva, r.recibido, r.cambio,
         coalesce(r.estado, 'Pendiente'), v_cid
  from jsonb_populate_record(null::public.orders, p_order) r
  on conflict (business_id, num) do update set
    fecha = excluded.fecha, hora = excluded.hora, cliente = excluded.cliente,
    direccion = excluded.direccion, comentarios = excluded.comentarios,
    metodo_pago = excluded.metodo_pago, ajuste = excluded.ajuste, total = excluded.total,
    iva_rate = excluded.iva_rate, iva_amount = excluded.iva_amount,
    recibido = excluded.recibido, cambio = excluded.cambio, estado = excluded.estado,
    client_id = coalesce(o.client_id, excluded.client_id);

  delete from public.order_items
   where business_id = v_bid and order_num = v_num;

  insert into public.order_items (business_id, order_num, line, product_id, product, qty, unit_price)
  select v_bid, v_num, r.line, coalesce(r.product_id, ''), r.product, r.qty, r.unit_price
  from jsonb_populate_recordset(null::public.order_items, coalesce(p_items, '[]'::jsonb)) r;

  return v_num;
end $$;

revoke all on function public.save_order(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_order(jsonb, jsonb, boolean) to authenticated;

do $$
begin
  if not exists (
    select 1 from public.businesses
    where id = '00000000-0000-4000-8000-000000000001'
      and iva_rate = 0
  ) then
    raise exception '016: La Smashiza no quedó en IVA 0';
  end if;
  if exists (
    select 1 from public.businesses
    where iva_rate is null or iva_rate < 0 or iva_rate > 100
  ) then
    raise exception '016: hay una tasa de IVA fuera de 0 a 100';
  end if;
  raise notice 'OK 016 iva por negocio: tasa en 0; el total guardado es base + iva';
end $$;
