alter table public.assets
  drop constraint if exists assets_asset_type_check;

alter table public.assets
  add constraint assets_asset_type_check
  check (
    asset_type in (
      'logo',
      'photo',
      'generated_artwork',
      'brand_asset',
      'invoice',
      'document',
      'other'
    )
  );
