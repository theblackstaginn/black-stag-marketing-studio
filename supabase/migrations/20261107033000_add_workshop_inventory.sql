-- Private materials and wholesale merchandise ledgers for Lace & Leather Arcane.
-- Match the existing BSMS brand-owner authorization model.
create table if not exists public.workshop_inventory (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  ledger_type text not null check (ledger_type in ('wand','leather','cart')),
  item_name text not null check (length(trim(item_name)) between 1 and 180),
  category text not null default '',
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  unit text not null default 'each',
  unit_cost numeric(12,2) check (unit_cost >= 0),
  retail_price numeric(12,2) check (retail_price >= 0),
  reorder_level numeric(12,2) not null default 0 check (reorder_level >= 0),
  supplier text not null default '',
  source_url text not null default '',
  item_status text not null default 'in_stock' check (item_status in ('in_stock','needed','ordered','archived')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workshop_inventory_brand_type_idx
  on public.workshop_inventory (brand_id, ledger_type);
alter table public.workshop_inventory enable row level security;
grant select,insert,update,delete on public.workshop_inventory to authenticated;
revoke all on public.workshop_inventory from anon;
drop policy if exists "Brand owners manage workshop inventory" on public.workshop_inventory;
create policy "Brand owners manage workshop inventory"
  on public.workshop_inventory for all to authenticated
  using (public.owns_brand(brand_id))
  with check (public.owns_brand(brand_id));
