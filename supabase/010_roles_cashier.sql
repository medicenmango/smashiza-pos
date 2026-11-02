-- Smashiza POS — Hito 4: roles owner vs cashier (+ invite).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No toca datos de La Smashiza.
--
-- Dueño: menú, costos, inventario (alta), branding, borrar negocio, invitar.
-- Cajero: órdenes (alta/estado), lectura de menú/recetas para vender.
-- Invitar: el cajero debe tener cuenta Auth (signup); el dueño pega su correo.

-- ═══════════════════════════════════════════════════════════════
-- 1. apply_movement: SECURITY DEFINER
--    (el cajero inserta movimientos; el trigger actualiza stock)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.apply_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory
     set stock = stock + new.qty
   where name = new.ingredient
     and business_id = new.business_id;
  return new;
end $$;

revoke all on function public.apply_movement() from public, anon;

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS: setup/catálogo = write solo owner; órdenes = member
-- ═══════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  -- Tablas de configuración: SELECT miembro, write dueño
  foreach t in array array[
    'categories','menu_items','catalog','price_history','recipes','inventory'
  ] loop
    execute format('drop policy if exists member_all on public.%I', t);
    execute format('drop policy if exists member_select on public.%I', t);
    execute format('drop policy if exists owner_write on public.%I', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy member_select on public.%I for select to authenticated
         using (public.is_business_member(business_id))', t);
    execute format(
      'create policy owner_write on public.%I for all to authenticated
         using (public.is_business_owner(business_id))
         with check (public.is_business_owner(business_id))', t);
  end loop;

  -- Costos: solo dueño (ni lectura para cajero)
  drop policy if exists member_all on public.product_costs;
  drop policy if exists member_select on public.product_costs;
  drop policy if exists owner_write on public.product_costs;
  drop policy if exists owner_all on public.product_costs;
  create policy owner_all on public.product_costs for all to authenticated
    using (public.is_business_owner(business_id))
    with check (public.is_business_owner(business_id));

  -- Movimientos: miembro puede insertar (entrega) y leer; upserts de sync
  drop policy if exists member_all on public.inventory_movements;
  drop policy if exists member_select on public.inventory_movements;
  drop policy if exists member_insert on public.inventory_movements;
  drop policy if exists member_update on public.inventory_movements;
  drop policy if exists owner_write on public.inventory_movements;
  create policy member_select on public.inventory_movements for select to authenticated
    using (public.is_business_member(business_id));
  create policy member_insert on public.inventory_movements for insert to authenticated
    with check (public.is_business_member(business_id));
  create policy member_update on public.inventory_movements for update to authenticated
    using (public.is_business_member(business_id))
    with check (public.is_business_member(business_id));
  create policy owner_write on public.inventory_movements for delete to authenticated
    using (public.is_business_owner(business_id));

  -- Órdenes: cualquier miembro (cajero vende y cambia estado)
  foreach t in array array['orders','order_items'] loop
    execute format('drop policy if exists member_all on public.%I', t);
    execute format('drop policy if exists member_select on public.%I', t);
    execute format('drop policy if exists owner_write on public.%I', t);
    execute format(
      'create policy member_all on public.%I for all to authenticated
         using (public.is_business_member(business_id))
         with check (public.is_business_member(business_id))', t);
  end loop;
end $$;

-- inventory: el cajero NO inserta/borra ítems; owner_write ya cubre ALL para owner.
-- member_select solo SELECT. Stock lo mueve apply_movement (definer).

-- ═══════════════════════════════════════════════════════════════
-- 3. RPCs: listar / invitar / quitar cajeros
-- ═══════════════════════════════════════════════════════════════

drop function if exists public.list_business_members(uuid);
create function public.list_business_members(p_business_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'list_business_members: no autenticado';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'list_business_members: sin membresía';
  end if;

  return query
  select m.user_id,
         coalesce(u.email, '')::text,
         m.role,
         m.created_at
  from public.business_members m
  left join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
  order by case m.role when 'owner' then 0 when 'cashier' then 1 else 2 end, u.email;
end $$;

revoke all on function public.list_business_members(uuid) from public, anon;
grant execute on function public.list_business_members(uuid) to authenticated;

create or replace function public.invite_business_cashier(
  p_business_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'invite_business_cashier: no autenticado';
  end if;
  if p_business_id is null then
    raise exception 'invite_business_cashier: business_id requerido';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'invite_business_cashier: solo el dueño puede invitar';
  end if;
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'invite_business_cashier: correo inválido';
  end if;

  select u.id into v_uid
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_uid is null then
    raise exception 'invite_business_cashier: ese correo no tiene cuenta. Pídele que cree cuenta en el POS (Crear cuenta) y vuelve a invitar';
  end if;

  if v_uid = auth.uid() then
    raise exception 'invite_business_cashier: no puedes invitarte a ti mismo';
  end if;

  if exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = v_uid and m.role = 'owner'
  ) then
    raise exception 'invite_business_cashier: ese usuario ya es dueño de este negocio';
  end if;

  insert into public.business_members (user_id, business_id, role)
  values (v_uid, p_business_id, 'cashier')
  on conflict (user_id, business_id) do update
    set role = excluded.role
    where public.business_members.role is distinct from 'owner';

  return v_uid;
end $$;

revoke all on function public.invite_business_cashier(uuid, text) from public, anon;
grant execute on function public.invite_business_cashier(uuid, text) to authenticated;

create or replace function public.remove_business_member(
  p_business_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_owners int;
begin
  if auth.uid() is null then
    raise exception 'remove_business_member: no autenticado';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'remove_business_member: solo el dueño puede quitar miembros';
  end if;
  if p_user_id is null then
    raise exception 'remove_business_member: user_id requerido';
  end if;

  select m.role into v_role
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id;

  if v_role is null then
    raise exception 'remove_business_member: no es miembro';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owners
    from public.business_members m
    where m.business_id = p_business_id and m.role = 'owner';
    if v_owners <= 1 then
      raise exception 'remove_business_member: no se puede quitar al único dueño';
    end if;
    if p_user_id = auth.uid() then
      raise exception 'remove_business_member: no puedes quitarte a ti mismo como dueño';
    end if;
  end if;

  delete from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
end $$;

revoke all on function public.remove_business_member(uuid, uuid) from public, anon;
grant execute on function public.remove_business_member(uuid, uuid) to authenticated;

do $$
begin
  raise notice 'OK 010 roles: owner write catálogo/inventario; cashier órdenes; invite_business_cashier';
end $$;
