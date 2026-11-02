-- Smashiza POS — fix delete_my_business (sin tocar storage.objects).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Reemplaza la RPC del 008: el DELETE directo a storage.objects provoca
-- el error "tables is not allowed" en proyectos Supabase.
-- Los logos se borran desde la app con la Storage API antes de llamar esta RPC.

create or replace function public.delete_my_business(
  p_business_id uuid,
  p_confirm_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  smashiza uuid := '00000000-0000-4000-8000-000000000001';
  v_name text;
  v_ticket text;
  v_confirm text := lower(trim(coalesce(p_confirm_name, '')));
begin
  if auth.uid() is null then
    raise exception 'delete_my_business: no autenticado';
  end if;
  if p_business_id is null then
    raise exception 'delete_my_business: business_id requerido';
  end if;
  if p_business_id = smashiza then
    raise exception 'delete_my_business: no se puede borrar La Smashiza';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'delete_my_business: solo el dueño puede borrar el negocio';
  end if;

  select b.name, b.ticket_name into v_name, v_ticket
  from public.businesses b
  where b.id = p_business_id;

  if v_name is null then
    raise exception 'delete_my_business: negocio no encontrado';
  end if;

  if v_confirm = '' then
    raise exception 'delete_my_business: escribe el nombre del negocio para confirmar';
  end if;

  if v_confirm is distinct from lower(trim(v_name))
     and v_confirm is distinct from lower(trim(coalesce(v_ticket, ''))) then
    raise exception 'delete_my_business: el nombre no coincide (escribe exactamente el nombre del negocio)';
  end if;

  -- Solo tablas public del tenant (NO storage.objects)
  delete from public.order_items where business_id = p_business_id;
  delete from public.orders where business_id = p_business_id;
  delete from public.inventory_movements where business_id = p_business_id;
  delete from public.recipes where business_id = p_business_id;
  delete from public.inventory where business_id = p_business_id;
  delete from public.price_history where business_id = p_business_id;
  delete from public.product_costs where business_id = p_business_id;
  delete from public.catalog where business_id = p_business_id;
  delete from public.menu_items where business_id = p_business_id;
  delete from public.categories where business_id = p_business_id;

  -- Members caen por ON DELETE CASCADE
  delete from public.businesses where id = p_business_id;
end $$;

revoke all on function public.delete_my_business(uuid, text) from public, anon;
grant execute on function public.delete_my_business(uuid, text) to authenticated;

do $$
begin
  raise notice 'OK delete_my_business fix: sin storage.objects; logos via Storage API en la app';
end $$;
