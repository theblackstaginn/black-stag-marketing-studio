-- Extend owner-reviewed BSWD prospect opportunities to genuinely obsolete websites.
-- Existing rows are unaffected. Research must substantiate the classification before import.
-- No changes to RLS, audit triggers, sender approval, or outreach behavior.
alter table public.bswd_prospects
  drop constraint if exists bswd_prospects_opportunity_type_check;
alter table public.bswd_prospects
  add constraint bswd_prospects_opportunity_type_check
  check (
    opportunity_type is null or
    opportunity_type in ('no_website','social_only','severely_broken','outdated_site')
  );
comment on column public.bswd_prospects.opportunity_type is
  'Research classification: no independent site, social only, verified broken site, or comprehensively outdated site. A healthy existing site is never a prospect.';
