-- El mismo nombre puede existir en dos categorías (ej. "Papas Gajo" como papas y como extra).
alter table public.menu_items drop constraint if exists menu_items_name_key;

-- Guarda una orden con sus líneas en una sola transacción.
-- p_is_new: si el número ya existe (otro dispositivo lo usó), se asigna el siguiente libre.
-- Devuelve el número final de la orden. Corre con los permisos de quien llama (RLS aplica).
create or replace function public.save_order(p_order jsonb, p_items jsonb, p_is_new boolean default false)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_num integer := (p_order->>'num')::integer;
begin
  if p_is_new then
    perform pg_advisory_xact_lock(hashtext('smashiza_orders_num'));
    if exists (select 1 from public.orders where num = v_num) then
      select coalesce(max(num), 0) + 1 into v_num from public.orders;
    end if;
  end if;

  insert into public.orders (num, fecha, hora, cliente, direccion, comentarios, metodo_pago,
                             ajuste, total, recibido, cambio, estado)
  select v_num, r.fecha, r.hora, coalesce(r.cliente, ''), coalesce(r.direccion, ''),
         coalesce(r.comentarios, ''), coalesce(r.metodo_pago, 'Efectivo'),
         coalesce(r.ajuste, 0), coalesce(r.total, 0), r.recibido, r.cambio,
         coalesce(r.estado, 'Pendiente')
  from jsonb_populate_record(null::public.orders, p_order) r
  on conflict (num) do update set
    fecha = excluded.fecha, hora = excluded.hora, cliente = excluded.cliente,
    direccion = excluded.direccion, comentarios = excluded.comentarios,
    metodo_pago = excluded.metodo_pago, ajuste = excluded.ajuste, total = excluded.total,
    recibido = excluded.recibido, cambio = excluded.cambio, estado = excluded.estado;

  delete from public.order_items where order_num = v_num;
  insert into public.order_items (order_num, line, product_id, product, qty, unit_price)
  select v_num, r.line, coalesce(r.product_id, ''), r.product, r.qty, r.unit_price
  from jsonb_populate_recordset(null::public.order_items, p_items) r;

  return v_num;
end $$;

revoke all on function public.save_order(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_order(jsonb, jsonb, boolean) to authenticated;
