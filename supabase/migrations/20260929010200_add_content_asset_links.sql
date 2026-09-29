-- Link Content Studio items to Asset Vault items.

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role text not null default 'primary'
    check (role in ('primary','supporting','reference')),
  caption text,
  created_at timestamptz not null default now(),
  unique (content_id, asset_id)
);

create index if not exists content_assets_content_id_idx
  on public.content_assets(content_id);

create index if not exists content_assets_asset_id_idx
  on public.content_assets(asset_id);

alter table public.content_assets enable row level security;

drop policy if exists "Owners can manage content assets"
  on public.content_assets;

create policy "Owners can manage content assets"
  on public.content_assets
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.content_items c
      join public.assets a on a.id = content_assets.asset_id
      where c.id = content_assets.content_id
        and public.owns_brand(c.brand_id)
        and public.owns_brand(a.brand_id)
        and c.brand_id = a.brand_id
    )
  )
  with check (
    exists (
      select 1
      from public.content_items c
      join public.assets a on a.id = content_assets.asset_id
      where c.id = content_assets.content_id
        and public.owns_brand(c.brand_id)
        and public.owns_brand(a.brand_id)
        and c.brand_id = a.brand_id
    )
  );
