-- La Smashiza POS — guardado seguro desde varios dispositivos y sin conexión.
-- Pegar completo en SQL Editor → Run. Es idempotente: se puede volver a correr.

-- El mismo nombre puede existir en dos categorías (ej. "Papas Gajo" como papas y como extra).
alter table public.menu_items drop constraint if exists menu_items_name_key;

-- Id generado en el dispositivo: un reintento tras perder la respuesta no duplica nada.
alter table public.orders add column if not exists client_id uuid;
create unique index if not exists orders_client_id_key on public.orders (client_id);
alter table public.inventory_movements add column if not exists client_id uuid;
create unique index if not exists inventory_movements_client_id_key on public.inventory_movements (client_id);

-- El stock lo mueve la base: cada movimiento suma su cantidad. Así dos dispositivos no se pisan.
create or replace function public.apply_movement()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.inventory set stock = stock + new.qty where name = new.ingredient;
  return new;
end $$;

drop trigger if exists apply_movement on public.inventory_movements;
create trigger apply_movement after insert on public.inventory_movements
  for each row execute function public.apply_movement();

-- Guarda una orden con sus líneas en una sola transacción y devuelve su número final.
-- Si ya existe una orden con el mismo client_id, se actualiza esa (reintento).
-- Si es nueva y el número ya lo usó otro dispositivo, se asigna el siguiente libre.
-- Corre con los permisos de quien llama (RLS aplica).
create or replace function public.save_order(p_order jsonb, p_items jsonb, p_is_new boolean default false)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_num   integer := (p_order->>'num')::integer;
  v_cid   uuid    := nullif(p_order->>'client_id', '')::uuid;
  v_found integer;
begin
  if p_is_new then
    perform pg_advisory_xact_lock(hashtext('smashiza_orders_num'));
  end if;
  if v_cid is not null then
    select num into v_found from public.orders where client_id = v_cid;
  end if;
  if v_found is not null then
    v_num := v_found;
  elsif p_is_new and exists (select 1 from public.orders where num = v_num) then
    select coalesce(max(num), 0) + 1 into v_num from public.orders;
  end if;

  insert into public.orders as o (num, fecha, hora, cliente, direccion, comentarios, metodo_pago,
                                  ajuste, total, recibido, cambio, estado, client_id)
  select v_num, r.fecha, r.hora, coalesce(r.cliente, ''), coalesce(r.direccion, ''),
         coalesce(r.comentarios, ''), coalesce(r.metodo_pago, 'Efectivo'),
         coalesce(r.ajuste, 0), coalesce(r.total, 0), r.recibido, r.cambio,
         coalesce(r.estado, 'Pendiente'), v_cid
  from jsonb_populate_record(null::public.orders, p_order) r
  on conflict (num) do update set
    fecha = excluded.fecha, hora = excluded.hora, cliente = excluded.cliente,
    direccion = excluded.direccion, comentarios = excluded.comentarios,
    metodo_pago = excluded.metodo_pago, ajuste = excluded.ajuste, total = excluded.total,
    recibido = excluded.recibido, cambio = excluded.cambio, estado = excluded.estado,
    client_id = coalesce(o.client_id, excluded.client_id);

  delete from public.order_items where order_num = v_num;
  insert into public.order_items (order_num, line, product_id, product, qty, unit_price)
  select v_num, r.line, coalesce(r.product_id, ''), r.product, r.qty, r.unit_price
  from jsonb_populate_recordset(null::public.order_items, p_items) r;

  return v_num;
end $$;

revoke all on function public.save_order(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_order(jsonb, jsonb, boolean) to authenticated;
revoke all on function public.apply_movement() from public, anon;
