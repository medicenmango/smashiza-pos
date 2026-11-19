-- Smashiza POS — look del negocio: fuente y color de letra.
-- Pegar completo en Supabase → SQL Editor → Run.
-- Idempotente. No borra datos.
-- Reutiliza color_primary, color_secondary y color_bg del 006.
-- Solo agrega font_family y font_color.
-- La Smashiza queda en retro + #ffd700 si esas celdas estaban vacías.

alter table public.businesses
  add column if not exists font_family text not null default 'retro';

alter table public.businesses
  add column if not exists font_color text not null default '#ffd700';

update public.businesses
set font_family = 'retro'
where font_family is null
   or trim(font_family) = ''
   or font_family not in ('retro', 'sans', 'rounded');

update public.businesses
set font_color = '#ffd700'
where font_color is null
   or trim(font_color) = ''
   or font_color !~ '^#[0-9A-Fa-f]{6}$';

alter table public.businesses drop constraint if exists businesses_font_family_chk;
alter table public.businesses
  add constraint businesses_font_family_chk
  check (font_family in ('retro', 'sans', 'rounded'));

-- list_my_businesses: mismas columnas que el 014 (incluye suspended) + fuente.
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
  font_color text
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
         coalesce(nullif(lower(trim(b.font_color)), ''), '#ffd700')
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.name;
$$;

revoke all on function public.list_my_businesses() from public, anon;
grant execute on function public.list_my_businesses() to authenticated;

drop function if exists public.update_my_business_theme(uuid, text, text, text);

create function public.update_my_business_theme(
  p_business_id uuid,
  p_color_primary text,
  p_color_secondary text,
  p_color_bg text,
  p_font_family text,
  p_font_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p text := lower(trim(coalesce(p_color_primary, '')));
  v_s text := lower(trim(coalesce(p_color_secondary, '')));
  v_b text := lower(trim(coalesce(p_color_bg, '')));
  v_font text := lower(trim(coalesce(p_font_family, '')));
  v_ink text := lower(trim(coalesce(p_font_color, '')));
begin
  if auth.uid() is null then
    raise exception 'update_my_business_theme: no autenticado';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'update_my_business_theme: solo el dueño puede editar el look';
  end if;
  if v_p !~ '^#[0-9a-f]{6}$' or v_s !~ '^#[0-9a-f]{6}$' or v_b !~ '^#[0-9a-f]{6}$' or v_ink !~ '^#[0-9a-f]{6}$' then
    raise exception 'update_my_business_theme: usa colores hex #rrggbb';
  end if;
  if v_font not in ('retro', 'sans', 'rounded') then
    raise exception 'update_my_business_theme: fuente inválida';
  end if;

  update public.businesses
  set color_primary = v_p,
      color_secondary = v_s,
      color_bg = v_b,
      font_family = v_font,
      font_color = v_ink
  where id = p_business_id;
end $$;

revoke all on function public.update_my_business_theme(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_business_theme(uuid, text, text, text, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from public.businesses
    where id = '00000000-0000-4000-8000-000000000001'
      and font_family = 'retro'
      and font_color = '#ffd700'
  ) then
    raise exception '015: La Smashiza no quedó en retro / #ffd700';
  end if;
  raise notice 'OK 015 business look: font_family + font_color; colores 006 se reutilizan';
end $$;
