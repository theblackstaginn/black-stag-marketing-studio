-- BSWD website discovery evidence, separate from manually reviewed qualification.
-- Only trusted server processes may write; the authenticated BSWD owner may read.
create table if not exists public.bswd_site_search_checks (
  prospect_id uuid primary key references public.bswd_prospects(id) on delete restrict,
  status text not null check (status in ('likely_website_found','possible_match','no_clear_site_found','search_error')),
  best_candidate_url text,
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates)='array'),
  query_count integer not null default 0 check (query_count between 0 and 3),
  provider text not null default 'tavily',
  match_reason text,
  checked_at timestamptz not null default now()
);
alter table public.bswd_site_search_checks enable row level security;
alter table public.bswd_site_search_checks force row level security;
revoke all on public.bswd_site_search_checks from public;
revoke all on public.bswd_site_search_checks from anon;
revoke all on public.bswd_site_search_checks from authenticated;
grant select on public.bswd_site_search_checks to authenticated;
create policy "bswd owner can review site-search evidence"
  on public.bswd_site_search_checks for select to authenticated
  using (exists (
    select 1 from public.bswd_prospects p
    join public.brands b on b.id='d51c76c3-a4a6-4109-99c2-5a4b3cff226b'
    where p.id=prospect_id
      and p.owner_id=(select auth.uid())
      and b.owner_id=(select auth.uid())
  ));
comment on table public.bswd_site_search_checks is 'Search-provider discovery evidence; no-result is not proof that a business lacks a website. Server-written, owner-only read, never used to send outreach.';
