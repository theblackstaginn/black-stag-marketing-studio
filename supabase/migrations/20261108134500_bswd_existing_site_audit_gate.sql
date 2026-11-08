-- BSWD: keep existing-site leads only when the research agent supplies a real site audit.
-- Additive metadata; no access/authorization/sending policy changes.
ALTER TABLE public.bswd_prospects
  ADD COLUMN IF NOT EXISTS site_audit jsonb;

ALTER TABLE public.bswd_prospects
  DROP CONSTRAINT IF EXISTS bswd_prospects_opportunity_type_check;
ALTER TABLE public.bswd_prospects
  ADD CONSTRAINT bswd_prospects_opportunity_type_check
  CHECK (opportunity_type IS NULL OR opportunity_type IN ('no_website','social_only','severely_broken','outdated_site'));

ALTER TABLE public.bswd_prospects
  ADD CONSTRAINT bswd_prospects_site_audit_check
  CHECK (
    opportunity_type IS NULL
    OR opportunity_type NOT IN ('severely_broken','outdated_site')
    OR (
      website_url IS NOT NULL
      AND site_audit IS NOT NULL
      AND jsonb_typeof(site_audit)='object'
      AND site_audit->>'result' = CASE WHEN opportunity_type='severely_broken' THEN 'material_defect' ELSE 'completely_outdated' END
      AND jsonb_typeof(site_audit->'evidence')='array'
      AND jsonb_array_length(site_audit->'evidence') >= CASE WHEN opportunity_type='outdated_site' THEN 2 ELSE 1 END
      AND jsonb_typeof(site_audit->'urls_checked')='array'
      AND jsonb_array_length(site_audit->'urls_checked') >= 1
      AND (site_audit->>'checked_at') IS NOT NULL
    )
  );

COMMENT ON COLUMN public.bswd_prospects.site_audit IS
  'Read-only public website audit evidence for existing-site prospect selection. Audit is a research claim, not an outbound permission.';
COMMENT ON COLUMN public.bswd_prospects.opportunity_type IS
  'Research-supported classification: no site, social only, material site defect, or demonstrably outdated site. Existing-site classes require site_audit.';
