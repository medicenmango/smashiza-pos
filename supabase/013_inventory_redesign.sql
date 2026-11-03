-- Smashiza POS — rediseño inventario (ingredientes únicos + order_client_id).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. NO borra órdenes ni movimientos de venta.
--
-- 1) Fusiona filas de inventory con el mismo nombre normalizado (suma stock).
-- 2) Reapunta recipes / movements al nombre canónico.
-- 3) Añade order_client_id a inventory_movements (descuento estable al Entregar).
-- 4) Índice único anti-duplicados por negocio.

create or replace function public.norm_inv_name(p text)
returns text
language sql
immutable
as $$
  select lower(trim(both from regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')));
$$;

revoke all on function public.norm_inv_name(text) from public, anon;
grant execute on function public.norm_inv_name(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 1. order_client_id en movimientos
-- ═══════════════════════════════════════════════════════════════

alter table public.inventory_movements
  add column if not exists order_client_id uuid;

create index if not exists inventory_movements_business_order_client_idx
  on public.inventory_movements (business_id, order_client_id)
  where order_client_id is not null;

-- Backfill desde orders.client_id cuando el num coincide
update public.inventory_movements m
   set order_client_id = o.client_id
  from public.orders o
 where m.order_client_id is null
   and o.client_id is not null
   and m.business_id = o.business_id
   and m.order_num = o.num
   and m.order_num is not null;

-- ═══════════════════════════════════════════════════════════════
-- 2. Fusionar ingredientes duplicados (por business_id + nombre norm)
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  r record;
  v_keep text;
  v_stock numeric;
  v_min numeric;
  v_ideal numeric;
  v_unit text;
  v_prov text;
  v_nota text;
  v_names text[];
  v_dup text;
begin
  for r in
    select business_id, public.norm_inv_name(name) as nkey
    from public.inventory
    group by business_id, public.norm_inv_name(name)
    having count(*) > 1
  loop
    -- Conservar el nombre de la fila con más stock (empate: nombre más corto / estable)
    select i.name, i.stock, i.minimo, i.ideal, i.unit, i.proveedor, i.nota
      into v_keep, v_stock, v_min, v_ideal, v_unit, v_prov, v_nota
    from public.inventory i
    where i.business_id = r.business_id
      and public.norm_inv_name(i.name) = r.nkey
    order by i.stock desc nulls last, length(i.name), i.name
    limit 1;

    select coalesce(sum(i.stock), 0),
           max(i.minimo),
           max(i.ideal)
      into v_stock, v_min, v_ideal
    from public.inventory i
    where i.business_id = r.business_id
      and public.norm_inv_name(i.name) = r.nkey;

    select array_agg(i.name) into v_names
    from public.inventory i
    where i.business_id = r.business_id
      and public.norm_inv_name(i.name) = r.nkey
      and i.name is distinct from v_keep;

    -- Reapuntar recetas de duplicados → canónico (evitar choque de PK)
    if v_names is not null then
      foreach v_dup in array v_names loop
        -- Si ya existe receta (product, keep), borra la del dup; si no, renombra
        delete from public.recipes d
         using public.recipes k
         where d.business_id = r.business_id
           and k.business_id = r.business_id
           and d.product = k.product
           and d.ingredient = v_dup
           and k.ingredient = v_keep;

        update public.recipes
           set ingredient = v_keep
         where business_id = r.business_id
           and ingredient = v_dup;

        update public.inventory_movements
           set ingredient = v_keep
         where business_id = r.business_id
           and ingredient = v_dup;

        delete from public.inventory
         where business_id = r.business_id
           and name = v_dup;
      end loop;
    end if;

    update public.inventory
       set stock = v_stock,
           minimo = coalesce(v_min, minimo),
           ideal = coalesce(v_ideal, ideal)
     where business_id = r.business_id
       and name = v_keep;

    raise notice 'OK merge inventario % → % (stock %)', r.nkey, v_keep, v_stock;
  end loop;
end $$;

-- Deduplicar recipes (mismo product+ingredient normalizado)
do $$
begin
  delete from public.recipes a
   using public.recipes b
   where a.business_id = b.business_id
     and public.norm_inv_name(a.product) = public.norm_inv_name(b.product)
     and public.norm_inv_name(a.ingredient) = public.norm_inv_name(b.ingredient)
     and a.ctid < b.ctid;
end $$;

-- Índice único: un nombre normalizado por negocio
drop index if exists inventory_business_norm_name_key;
create unique index inventory_business_norm_name_key
  on public.inventory (business_id, (public.norm_inv_name(name)));

do $$
begin
  raise notice 'OK 013 inventory redesign: merge duplicados + order_client_id + unique norm name';
end $$;
