-- Additive classification fields for the BSWD Prospect Desk.
-- Historical prospect rows remain readable and unclassified until reviewed.
-- No outreach, email sending, or automatic stage transitions are introduced.
ALTER TABLE public.bswd_prospects
  ADD COLUMN IF NOT EXISTS opportunity_type text,
  ADD COLUMN IF NOT EXISTS email_source_url text;
ALTER TABLE public.bswd_prospects
  ADD CONSTRAINT bswd_prospects_opportunity_type_check
  CHECK (opportunity_type IS NULL OR opportunity_type IN ('no_website','social_only','severely_broken'));
COMMENT ON COLUMN public.bswd_prospects.opportunity_type IS
  'Owner-reviewed website gap: no dedicated website, social presence only, or demonstrably broken website. NULL until independently researched.';
COMMENT ON COLUMN public.bswd_prospects.email_source_url IS
  'Public page showing the business email; records owner research evidence, not permission to send.';
