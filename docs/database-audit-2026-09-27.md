# Marketing Studio Database Audit — 2026-09-27

## Data population completed

Previously empty:
- brand_audiences
- products_services
- campaigns

Added from existing owner-approved/verified Brand Brain material:
- Stag & Stone: 7 audiences, 5 offerings, 1 draft campaign.
- Black Stag Web Design: 5 audiences, 3 offerings, 1 draft campaign.
- Lace & Leather: 2 offerings, 1 draft campaign.

No unsupported business claims were invented.

## Performance change applied

Added missing foreign-key indexes:
- ai_runs(campaign_id)
- marketing_feedback(content_id)

Migration: add_missing_fk_indexes

## Security advisor findings requiring review

Do not change these blindly; confirm intended function behavior first.

1. public.handle_new_user() is SECURITY DEFINER and executable by anon/authenticated.
2. public.rls_auto_enable() is SECURITY DEFINER and executable by anon/authenticated.
3. public.owns_brand(uuid) is SECURITY DEFINER and executable by authenticated.
4. Supabase Auth leaked-password protection is disabled.

Recommended next laptop/security session:
- inspect each function definition and call sites,
- revoke direct EXECUTE where direct RPC invocation is unnecessary,
- preserve trigger/policy behavior,
- enable leaked-password protection if compatible with the intended auth experience,
- rerun security advisors.

## Performance advisor findings requiring later cleanup

- Some profiles/brands policies call auth.uid() directly rather than through a select initplan.
- asset_folders has overlapping permissive policies for authenticated operations.
- Several indexes are currently reported unused. Do not remove them merely because the project is young; usage history is not yet sufficient.

## Principle

Security cleanup must preserve the proven OAuth/MCP and Stag UI behavior. One lint warning is not justification for rebuilding authentication.
