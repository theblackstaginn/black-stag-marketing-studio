# Security Remediation Plan

Date: 2026-09-27

## Confirmed advisor findings

### handle_new_user()

- SECURITY DEFINER trigger function.
- Creates a public.profiles row from a newly created auth user.
- Currently executable by anon and authenticated roles.
- Direct RPC execution is unnecessary for a trigger function.

Proposed remediation:
- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated.
- Preserve trigger ownership/execution behavior.
- Verify new-user signup/profile creation after change.

### rls_auto_enable()

- SECURITY DEFINER event-trigger function.
- Automatically enables RLS on newly created public tables.
- Currently executable by anon and authenticated roles.
- Direct client execution is unnecessary for an event-trigger function.

Proposed remediation:
- REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated.
- Verify the event trigger remains enabled and can execute as its owner.
- Create a disposable test table in a controlled migration and verify RLS auto-enables, then remove the table.

### owns_brand(uuid)

- SECURITY DEFINER helper used by RLS.
- anon EXECUTE is already false.
- authenticated EXECUTE is true.
- It returns only a boolean scoped to auth.uid() and is intentionally usable by authenticated RLS policies.

Recommendation:
- Do not revoke authenticated EXECUTE without testing policy behavior.
- Consider whether direct RPC exposure is acceptable; the function does not disclose another owner's data, only ownership truth for the caller.
- Preserve until a tested replacement exists.

### Leaked password protection

Supabase advisor reports leaked-password protection disabled.

Recommendation:
- Enable through Supabase Auth settings after confirming the intended login/signup experience.
- This is an Auth configuration change, not a database migration.

## Performance follow-up

Already fixed:
- index ai_runs(campaign_id)
- index marketing_feedback(content_id)

Later:
- rewrite direct auth.uid() RLS expressions to (select auth.uid()) where appropriate,
- consolidate overlapping asset_folders permissive policies,
- do not remove "unused" indexes yet; the application is young and usage statistics are not sufficient.

## Rollout rule

Security changes must be one small migration at a time, followed by:
1. auth test,
2. Stag UI test,
3. MCP read test,
4. MCP write test once writes exist,
5. advisor rerun.

Do not combine auth cleanup with MCP feature implementation.
