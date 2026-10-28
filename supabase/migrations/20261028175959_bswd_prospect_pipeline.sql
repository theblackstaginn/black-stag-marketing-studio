-- BSWD acquisition pipeline: additive schema, NOT applied to production.
-- Owner-scoped RLS. Review with existing Supabase migration conventions before deployment.
create extension if not exists pgcrypto;

create table if not exists public.bswd_prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_name text not null check (length(trim(business_name)) between 2 and 200),
  location text,
  website_url text,
  source_url text not null,
  source_checked_at timestamptz not null default now(),
  opportunity_evidence text,
  contact_channel text,
  contact_value text,
  prospect_key text not null,
  stage text not null default 'discovered'
    check (stage in ('discovered','researched','qualified','draft_ready','approved','contacted','replied','meeting','quoted','won','lost','do_not_contact')),
  suppressed_at timestamptz,
  suppression_reason text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, prospect_key),
  unique(id, owner_id),
  check (stage <> 'contacted' or last_contacted_at is not null)
);

create table if not exists public.bswd_outreach (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prospect_id uuid not null,
  subject text,
  draft_body text not null,
  channel text not null check(channel in ('email','contact_form','referral')),
  state text not null default 'draft' check(state in ('draft','approved','sent','replied','cancelled')),
  approved_at timestamptz,
  sent_at timestamptz,
  external_message_id text,
  created_at timestamptz not null default now(),
  foreign key (prospect_id,owner_id) references public.bswd_prospects(id,owner_id) on delete cascade,
  check(state not in ('approved','sent','replied') or approved_at is not null),
  check(state not in ('sent','replied') or sent_at is not null)
);

create table if not exists public.bswd_prospect_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prospect_id uuid not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (prospect_id,owner_id) references public.bswd_prospects(id,owner_id) on delete cascade
);

create index if not exists bswd_prospects_stage_idx on public.bswd_prospects(owner_id,stage,next_action_at);
create index if not exists bswd_outreach_prospect_idx on public.bswd_outreach(owner_id,prospect_id,created_at);
create index if not exists bswd_events_prospect_idx on public.bswd_prospect_events(owner_id,prospect_id,created_at);

alter table public.bswd_prospects enable row level security;
alter table public.bswd_outreach enable row level security;
alter table public.bswd_prospect_events enable row level security;
alter table public.bswd_prospects force row level security;
alter table public.bswd_outreach force row level security;
alter table public.bswd_prospect_events force row level security;

create policy "owner access prospects" on public.bswd_prospects
  for all to authenticated using(owner_id = (select auth.uid()) and exists (select 1 from public.brands b where b.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b.owner_id = (select auth.uid())))
  with check(owner_id = (select auth.uid()) and exists (select 1 from public.brands b where b.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b.owner_id = (select auth.uid())));
create policy "owner access outreach" on public.bswd_outreach
  for all to authenticated using(owner_id = (select auth.uid()) and exists (select 1 from public.brands b where b.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b.owner_id = (select auth.uid())))
  with check(owner_id = (select auth.uid()) and exists (select 1 from public.brands b where b.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b.owner_id = (select auth.uid())));
create policy "owner access events" on public.bswd_prospect_events
  for all to authenticated using(owner_id = (select auth.uid()) and exists (select 1 from public.brands b where b.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b.owner_id = (select auth.uid())))
  with check(owner_id = (select auth.uid()) and exists (select 1 from public.brands b where b.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b.owner_id = (select auth.uid())));

revoke all on public.bswd_prospects, public.bswd_outreach, public.bswd_prospect_events from anon;
revoke all on public.bswd_prospects, public.bswd_outreach, public.bswd_prospect_events from authenticated;
grant select,insert,update,delete on public.bswd_prospects, public.bswd_outreach, public.bswd_prospect_events to authenticated;

-- Before any sending implementation: enforce suppression/approval transactionally server-side.
-- Do not use a browser-side flag as the sole permission check.
