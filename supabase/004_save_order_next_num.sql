-- Smashiza POS — save_order: consecutivo real por negocio (max+1).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente (CREATE OR REPLACE). No toca filas existentes.
--
-- Bug: con p_is_new=true solo renumeraba si el num del cliente YA existía.
-- Un smoke test con num=999999 (libre) quedó como #999999 en vez de ~384.
-- Fix: en alta nueva (sin client_id previo) SIEMPRE asignar max(num)+1 del business_id.
-- Reintentos idempotentes (mismo client_id) siguen reutilizando el num ya guardado.
-- Actualizaciones (p_is_new=false) no cambian el num.

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
    -- Reintento offline / misma orden: conservar el número ya asignado
    v_num := v_found;
  elsif p_is_new then
    -- Alta nueva: ignorar num del cliente; siguiente consecutivo del negocio
    select coalesce(max(num), 0) + 1 into v_num
      from public.orders
     where business_id = v_bid;
  end if;
  -- p_is_new=false y sin client_id previo: se respeta v_num del payload (edición)

  if v_num is null or v_num <= 0 then
    raise exception 'save_order: num inválido';
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

do $$
begin
  raise notice 'OK save_order: altas nuevas usan max(num)+1 por business_id';
end $$;
