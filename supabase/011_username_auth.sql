-- Smashiza POS — cuentas por usuario (sin signup de correo).
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No toca el usuario email de Lynx.
--
-- Auth de Supabase sigue usando email por debajo: se guarda
--   {username}@users.smashiza.local
-- con email_confirmed_at = now() (sin confirmar correo).
-- La app solo muestra usuario + contraseña.
-- Signups del panel Auth pueden seguir deshabilitados.

create extension if not exists pgcrypto with schema extensions;

-- ═══════════════════════════════════════════════════════════════
-- 1. Helpers de username → email sintético
-- ═══════════════════════════════════════════════════════════════

create or replace function public.username_auth_domain()
returns text
language sql
immutable
as $$
  select 'users.smashiza.local'::text;
$$;

create or replace function public.normalize_username(p_username text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_username, '')));
begin
  if v = '' then
    raise exception 'usuario vacío';
  end if;
  if length(v) < 3 or length(v) > 32 then
    raise exception 'usuario: 3 a 32 caracteres';
  end if;
  if v !~ '^[a-z0-9][a-z0-9._-]*$' then
    raise exception 'usuario: solo letras, números, . _ - (empieza con letra o número)';
  end if;
  if position('@' in v) > 0 then
    raise exception 'usuario: no uses @ (eso es correo)';
  end if;
  return v;
end $$;

create or replace function public.username_to_email(p_username text)
returns text
language sql
immutable
as $$
  select public.normalize_username(p_username) || '@' || public.username_auth_domain();
$$;

create or replace function public.display_login_from_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or p_email = '' then ''
    when right(lower(p_email), length('@' || public.username_auth_domain()))
         = '@' || public.username_auth_domain()
      then split_part(lower(p_email), '@', 1)
    else p_email
  end;
$$;

revoke all on function public.username_auth_domain() from public, anon, authenticated;
revoke all on function public.normalize_username(text) from public, anon, authenticated;
revoke all on function public.username_to_email(text) from public, anon, authenticated;
-- display helper usable by authenticated UI via list RPC only; keep locked
revoke all on function public.display_login_from_email(text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2. Crear usuario Auth (security definer) sin API de signup
-- ═══════════════════════════════════════════════════════════════

create or replace function public.create_auth_user_with_username(
  p_username text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user text := public.normalize_username(p_username);
  v_email text := public.username_to_email(v_user);
  v_pass text := coalesce(p_password, '');
  v_id uuid := gen_random_uuid();
  v_instance uuid;
  v_encrypted text;
begin
  if length(v_pass) < 6 then
    raise exception 'contraseña: mínimo 6 caracteres';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'ese usuario ya existe: %', v_user;
  end if;

  select i.id into v_instance from auth.instances i limit 1;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  v_encrypted := extensions.crypt(v_pass, extensions.gen_salt('bf'));

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    v_instance,
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted,
    now(), -- confirmado ya: sin flujo de correo
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('username', v_user),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_id,
    jsonb_build_object(
      'sub', v_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_id::text,
    now(),
    now(),
    now()
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'ese usuario ya existe: %', v_user;
end $$;

revoke all on function public.create_auth_user_with_username(text, text) from public, anon, authenticated;
-- solo otras RPCs security definer la llaman (mismo owner)

-- ═══════════════════════════════════════════════════════════════
-- 3. Registrar dueño nuevo (anon OK) + crear cajero (owner)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.register_with_username(
  p_username text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Crea la cuenta Auth. La app luego hace signIn (no usa signup API).
  return public.create_auth_user_with_username(p_username, p_password);
end $$;

revoke all on function public.register_with_username(text, text) from public;
grant execute on function public.register_with_username(text, text) to anon, authenticated;

create or replace function public.create_business_cashier(
  p_business_id uuid,
  p_username text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'create_business_cashier: no autenticado';
  end if;
  if p_business_id is null then
    raise exception 'create_business_cashier: business_id requerido';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'create_business_cashier: solo el dueño puede crear cajeros';
  end if;

  v_uid := public.create_auth_user_with_username(p_username, p_password);

  insert into public.business_members (user_id, business_id, role)
  values (v_uid, p_business_id, 'cashier')
  on conflict (user_id, business_id) do update
    set role = excluded.role
    where public.business_members.role is distinct from 'owner';

  return v_uid;
end $$;

revoke all on function public.create_business_cashier(uuid, text, text) from public, anon;
grant execute on function public.create_business_cashier(uuid, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. list_business_members: mostrar usuario (no email sintético)
-- ═══════════════════════════════════════════════════════════════

drop function if exists public.list_business_members(uuid);
create function public.list_business_members(p_business_id uuid)
returns table (
  user_id uuid,
  email text,
  username text,
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
         coalesce(
           nullif(u.raw_user_meta_data->>'username', ''),
           public.display_login_from_email(u.email)
         )::text,
         m.role,
         m.created_at
  from public.business_members m
  left join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
  order by case m.role when 'owner' then 0 when 'cashier' then 1 else 2 end,
           3;
end $$;

revoke all on function public.list_business_members(uuid) from public, anon;
grant execute on function public.list_business_members(uuid) to authenticated;

do $$
begin
  raise notice 'OK 011 username auth: register_with_username + create_business_cashier (@users.smashiza.local)';
end $$;
