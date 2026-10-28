-- Private, owner-authored relationship/context notes for the BSWD Prospect Desk.
-- The existing owner-only RLS policy remains in force. This migration adds no grants,
-- broadens no policies, and does not modify any existing prospect data.

alter table public.bswd_prospects
  add column if not exists owner_notes text;

alter table public.bswd_prospects
  add constraint bswd_prospects_owner_notes_length
  check (owner_notes is null or char_length(owner_notes) <= 4000);

comment on column public.bswd_prospects.owner_notes is
  'Owner-authored private prospect context. Access is limited by the existing BSWD owner-only RLS policy.';
