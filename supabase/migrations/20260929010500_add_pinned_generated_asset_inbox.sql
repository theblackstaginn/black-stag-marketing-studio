-- Add a protected, pinned "Newly Created" intake folder to every brand.
-- Newly generated artwork without an explicit destination is routed here automatically.

alter table public.asset_folders
  add column if not exists is_pinned boolean not null default false,
  add column if not exists system_key text;

create unique index if not exists asset_folders_brand_system_key_uidx
  on public.asset_folders(brand_id, system_key)
  where system_key is not null;

insert into public.asset_folders (
  brand_id,
  parent_folder_id,
  name,
  description,
  is_pinned,
  system_key
)
select
  b.id,
  null,
  'Newly Created',
  'Brand-specific assets newly created in Content Studio or ChatGPT. Review them here before filing them into permanent folders.',
  true,
  'newly_created'
from public.brands b
where b.active = true
  and not exists (
    select 1
    from public.asset_folders f
    where f.brand_id = b.id
      and f.system_key = 'newly_created'
  );

create or replace function public.ensure_newly_created_asset_folder()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.asset_folders (
    brand_id,
    parent_folder_id,
    name,
    description,
    is_pinned,
    system_key
  )
  values (
    new.id,
    null,
    'Newly Created',
    'Brand-specific assets newly created in Content Studio or ChatGPT. Review them here before filing them into permanent folders.',
    true,
    'newly_created'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists brand_newly_created_asset_folder
  on public.brands;

create trigger brand_newly_created_asset_folder
  after insert on public.brands
  for each row
  execute function public.ensure_newly_created_asset_folder();

create or replace function public.route_new_generated_asset()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  intake_folder_id uuid;
begin
  if new.asset_type = 'generated_artwork' and new.folder_id is null then
    select id
      into intake_folder_id
    from public.asset_folders
    where brand_id = new.brand_id
      and system_key = 'newly_created'
    limit 1;

    if intake_folder_id is null then
      insert into public.asset_folders (
        brand_id,
        parent_folder_id,
        name,
        description,
        is_pinned,
        system_key
      )
      values (
        new.brand_id,
        null,
        'Newly Created',
        'Brand-specific assets newly created in Content Studio or ChatGPT. Review them here before filing them into permanent folders.',
        true,
        'newly_created'
      )
      returning id into intake_folder_id;
    end if;

    new.folder_id := intake_folder_id;
  end if;

  return new;
end;
$$;

drop trigger if exists assets_route_new_generated_asset
  on public.assets;

create trigger assets_route_new_generated_asset
  before insert on public.assets
  for each row
  execute function public.route_new_generated_asset();
