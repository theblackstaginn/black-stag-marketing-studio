create table if not exists public.meta_oauth_attempts (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  brand_id uuid not null references public.brands(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes')
);
alter table public.meta_oauth_attempts enable row level security;
revoke all on public.meta_oauth_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.meta_oauth_attempts to service_role;
create index if not exists meta_oauth_attempts_expiry_idx
on public.meta_oauth_attempts(expires_at);

create table if not exists public.meta_account_credentials (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  facebook_user_id text not null,
  facebook_name text,
  access_token_encrypted text not null,
  scopes text[] not null default '{}'::text[],
  access_token_expires_at timestamptz not null,
  authorized_by uuid not null references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meta_account_credentials enable row level security;
revoke all on public.meta_account_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.meta_account_credentials to service_role;

create table if not exists public.meta_ad_account_cache (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  ad_accounts jsonb not null default '[]'::jsonb,
  complete boolean not null default false,
  count integer not null default 0,
  warnings text[] not null default '{}'::text[],
  synced_at timestamptz not null default now()
);
alter table public.meta_ad_account_cache enable row level security;
revoke all on public.meta_ad_account_cache from public, anon, authenticated;
grant select, insert, update, delete on public.meta_ad_account_cache to service_role;
grant select on public.meta_ad_account_cache to authenticated;
drop policy if exists "Brand owners read own Meta ad account cache" on public.meta_ad_account_cache;
create policy "Brand owners read own Meta ad account cache"
on public.meta_ad_account_cache for select to authenticated
using (public.owns_brand(brand_id));

comment on table public.meta_account_credentials is
'Service-role-only AES-GCM encrypted Meta user access token for Black Stag Marketing Studio; never exposed to browser clients';
comment on table public.meta_ad_account_cache is
'Owner-only sanitized Meta ad account metadata cached for Black Stag Marketing Studio';
