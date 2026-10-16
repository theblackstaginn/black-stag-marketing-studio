create table if not exists public.black_stag_leads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  business_name text not null check (char_length(business_name) between 1 and 160),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  website_url text check (website_url is null or char_length(website_url) <= 500),
  contact_preference text not null default 'email'
    check (contact_preference in ('email','phone','text','either')),
  primary_need text check (primary_need is null or char_length(primary_need) <= 120),
  message text check (message is null or char_length(message) <= 3000),
  source text not null default 'website_checkup'
    check (char_length(source) between 1 and 80),
  utm_source text check (utm_source is null or char_length(utm_source) <= 160),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 160),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  utm_content text check (utm_content is null or char_length(utm_content) <= 200),
  utm_term text check (utm_term is null or char_length(utm_term) <= 200),
  fbclid text check (fbclid is null or char_length(fbclid) <= 500),
  landing_path text check (landing_path is null or char_length(landing_path) <= 300),
  status text not null default 'new'
    check (status in ('new','contacted','qualified','quoted','won','lost','spam')),
  consent_to_contact boolean not null default true,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create index if not exists black_stag_leads_brand_id_idx
  on public.black_stag_leads(brand_id);
create index if not exists black_stag_leads_campaign_id_idx
  on public.black_stag_leads(campaign_id);
create index if not exists black_stag_leads_status_created_idx
  on public.black_stag_leads(status, created_at desc);
create index if not exists black_stag_leads_work_item_id_idx
  on public.black_stag_leads(work_item_id);

alter table public.black_stag_leads enable row level security;
revoke all on public.black_stag_leads from public, anon, authenticated;
grant select, update on public.black_stag_leads to authenticated;
grant select, insert, update, delete on public.black_stag_leads to service_role;

drop policy if exists "Brand owners read own Black Stag leads" on public.black_stag_leads;
create policy "Brand owners read own Black Stag leads"
on public.black_stag_leads
for select
to authenticated
using (public.owns_brand(brand_id));

drop policy if exists "Brand owners update own Black Stag leads" on public.black_stag_leads;
create policy "Brand owners update own Black Stag leads"
on public.black_stag_leads
for update
to authenticated
using (public.owns_brand(brand_id))
with check (public.owns_brand(brand_id));

create table if not exists private.black_stag_lead_throttle (
  ip_digest text primary key check (ip_digest ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);

revoke all on private.black_stag_lead_throttle from public, anon, authenticated;
grant select, insert, update, delete on private.black_stag_lead_throttle to service_role;

create or replace function public.black_stag_claim_lead_slot(p_ip_digest text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_attempts integer;
begin
  if length(p_ip_digest) <> 64 or p_ip_digest !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into private.black_stag_lead_throttle as t (ip_digest, window_start, attempts, updated_at)
    values (p_ip_digest, now(), 1, now())
  on conflict (ip_digest) do update
    set attempts = case
      when t.window_start <= now() - interval '1 hour' then 1
      else t.attempts + 1
    end,
    window_start = case
      when t.window_start <= now() - interval '1 hour' then now()
      else t.window_start
    end,
    updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= 6;
end;
$function$;

revoke all on function public.black_stag_claim_lead_slot(text) from public, anon, authenticated;
grant execute on function public.black_stag_claim_lead_slot(text) to service_role;

comment on table public.black_stag_leads is
'Private Black Stag Web Design prospect inquiries captured from owned landing pages and attached to the BSMS follow-up pipeline.';
comment on table private.black_stag_lead_throttle is
'Abuse throttle for the public Black Stag lead intake Edge Function. Stores only a one-way address digest, never a raw IP address.';
