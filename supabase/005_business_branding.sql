-- Smashiza POS — Hito 2: alta de negocio + branding de ticket.
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No borra datos de La Smashiza ni de otros tenants.
--
-- Añade campos de marca en businesses, RPCs create/update,
-- amplía list_my_businesses y bucket Storage business-logos.

-- ═══════════════════════════════════════════════════════════════
-- 1. Columnas de branding (null-safe; seed Smashiza sin pisar edits)
-- ═══════════════════════════════════════════════════════════════

alter table public.businesses add column if not exists ticket_name text;
alter table public.businesses add column if not exists ticket_tagline text;
alter table public.businesses add column if not exists phone text;
alter table public.businesses add column if not exists ticket_footer text;
alter table public.businesses add column if not exists logo_path text;

-- Defaults solo donde falte (no sobrescribe lo ya configurado)
update public.businesses
set ticket_name = coalesce(nullif(trim(ticket_name), ''), name)
where ticket_name is null or trim(ticket_name) = '';

update public.businesses
set phone = coalesce(phone, ''),
    ticket_footer = coalesce(nullif(trim(ticket_footer), ''), 'Confirma tu pedido por WhatsApp'),
    ticket_tagline = coalesce(ticket_tagline, ''),
    logo_path = coalesce(logo_path, '')
where true;

-- Tenant #1: tagline clásico si aún está vacío
update public.businesses
set ticket_name = coalesce(nullif(trim(ticket_name), ''), 'LA SMASHIZA'),
    ticket_tagline = coalesce(nullif(trim(ticket_tagline), ''), 'RETRO BURGER')
where id = '00000000-0000-4000-8000-000000000001'::uuid;

-- ═══════════════════════════════════════════════════════════════
-- 2. Helpers de rol
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_business_id is not null
     and exists (
       select 1
       from public.business_members m
       where m.business_id = p_business_id
         and m.user_id = auth.uid()
         and m.role = 'owner'
     );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS: owners pueden actualizar su negocio
-- ═══════════════════════════════════════════════════════════════

drop policy if exists businesses_update_owner on public.businesses;
create policy businesses_update_owner on public.businesses
  for update to authenticated
  using (public.is_business_owner(id))
  with check (public.is_business_owner(id));

grant update on public.businesses to authenticated;

-- Inserts de negocios/membresías solo vía RPC security definer (abajo).

-- ═══════════════════════════════════════════════════════════════
-- 4. list_my_businesses con branding
-- ═══════════════════════════════════════════════════════════════

-- Cambiar columnas de retorno exige DROP (CREATE OR REPLACE no basta)
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
  logo_path text
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
         coalesce(b.logo_path, '')
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.name;
$$;

revoke all on function public.list_my_businesses() from public, anon;
grant execute on function public.list_my_businesses() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. RPC: crear mi negocio (owner)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.create_my_business(
  p_name text,
  p_ticket_name text default null,
  p_ticket_tagline text default null,
  p_phone text default null,
  p_ticket_footer text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_base text;
  v_id uuid;
  v_n int := 0;
begin
  if v_uid is null then
    raise exception 'create_my_business: no autenticado';
  end if;
  if v_name = '' then
    raise exception 'create_my_business: el nombre es obligatorio';
  end if;

  v_base := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'negocio'; end if;
  v_slug := v_base;

  while exists (select 1 from public.businesses b where b.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  insert into public.businesses (
    name, slug, ticket_name, ticket_tagline, phone, ticket_footer, logo_path
  ) values (
    v_name,
    v_slug,
    coalesce(nullif(trim(coalesce(p_ticket_name, '')), ''), v_name),
    coalesce(p_ticket_tagline, ''),
    coalesce(p_phone, ''),
    coalesce(nullif(trim(coalesce(p_ticket_footer, '')), ''), 'Confirma tu pedido por WhatsApp'),
    ''
  )
  returning id into v_id;

  insert into public.business_members (user_id, business_id, role)
  values (v_uid, v_id, 'owner');

  return v_id;
end $$;

revoke all on function public.create_my_business(text, text, text, text, text) from public, anon;
grant execute on function public.create_my_business(text, text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. RPC: actualizar branding (solo owner)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.update_my_business_branding(
  p_business_id uuid,
  p_ticket_name text,
  p_ticket_tagline text default '',
  p_phone text default '',
  p_ticket_footer text default '',
  p_logo_path text default null  -- null = no cambiar; '' = quitar logo
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'update_my_business_branding: no autenticado';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'update_my_business_branding: solo el dueño puede editar la marca';
  end if;

  v_name := trim(coalesce(p_ticket_name, ''));
  if v_name = '' then
    raise exception 'update_my_business_branding: el nombre comercial es obligatorio';
  end if;

  update public.businesses b
  set ticket_name = v_name,
      ticket_tagline = coalesce(p_ticket_tagline, ''),
      phone = coalesce(p_phone, ''),
      ticket_footer = coalesce(nullif(trim(coalesce(p_ticket_footer, '')), ''), 'Confirma tu pedido por WhatsApp'),
      logo_path = case
        when p_logo_path is null then b.logo_path
        else coalesce(p_logo_path, '')
      end,
      -- Mantener name interno alineado al comercial si el dueño lo cambia
      name = v_name
  where b.id = p_business_id;
end $$;

revoke all on function public.update_my_business_branding(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_business_branding(uuid, text, text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. Storage: logos públicos por negocio
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Políticas: lectura pública; escritura solo owner del business_id (primer segmento del path)
drop policy if exists business_logos_public_read on storage.objects;
create policy business_logos_public_read on storage.objects
  for select to public
  using (bucket_id = 'business-logos');

drop policy if exists business_logos_owner_insert on storage.objects;
create policy business_logos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-logos'
    and public.is_business_owner((split_part(name, '/', 1))::uuid)
  );

drop policy if exists business_logos_owner_update on storage.objects;
create policy business_logos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-logos'
    and public.is_business_owner((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'business-logos'
    and public.is_business_owner((split_part(name, '/', 1))::uuid)
  );

drop policy if exists business_logos_owner_delete on storage.objects;
create policy business_logos_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-logos'
    and public.is_business_owner((split_part(name, '/', 1))::uuid)
  );

-- ═══════════════════════════════════════════════════════════════
-- 8. Verificación
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  smashiza uuid := '00000000-0000-4000-8000-000000000001';
  tn text;
  has_bucket boolean;
begin
  select ticket_name into tn from public.businesses where id = smashiza;
  select exists(select 1 from storage.buckets where id = 'business-logos') into has_bucket;
  if tn is null or trim(tn) = '' then
    raise exception 'La Smashiza sin ticket_name tras seed';
  end if;
  if not has_bucket then
    raise exception 'Bucket business-logos no creado';
  end if;
  raise notice 'OK branding: Smashiza ticket_name=%, bucket business-logos listo', tn;
end $$;
