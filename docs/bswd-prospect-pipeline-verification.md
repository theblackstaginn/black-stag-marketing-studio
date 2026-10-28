# BSWD prospect pipeline verification checklist

This feature remains a draft PR. **Do not deploy until every gate passes.**

## Schema
- Apply both migrations to an isolated test database, in order.
- Confirm the three tables exist, RLS is enabled, and only owner-scoped policies apply.
- Confirm public/anon users cannot read or write prospect data.
- Confirm authenticated user A cannot read, update, or delete user B's records.
- Confirm a second user's record cannot be referenced in another user's outreach.

## Lifecycle security
- Insert a normal researched prospect: allowed.
- Insert prospect already marked contacted, replied, quoted, or won: rejected.
- Insert a duplicate owner + normalized business/location: rejected.
- Change owner_id or prospect_key after creation: rejected.
- Mark prospect do_not_contact: suppression timestamp recorded.
- Attempt to remove suppression or reopen the prospect: rejected.
- Create a draft for suppressed prospect: rejected.
- Create outreach already approved or sent: rejected.
- Approve a draft for unsuppressed prospect: allowed, but not sent.
- Modify approved content, recipient association, sent timestamp, or external message ID: rejected.
- Attempt to set outreach state to sent or replied from browser: rejected.

## UX
- Authenticated BSWD owner can open prospect-desk.html and load records.
- Signed-out user sees gate, not prospect details.
- Existing Lead to Revenue Desk remains functional.
- Form validates source URL and opportunity evidence; duplicate error is intelligible.
- Draft queue can save and approve without sending; suppressed prospects show no draft editor.
- Mobile layout works and long draft content wraps.

## Release
- Run database security and performance advisors, triage all relevant findings.
- Confirm migrations in test, then controlled production application.
- Re-run owner isolation checks against deployed schema with disposable test records.
- Link Prospect Desk from existing owner-only navigation.
- Merge only after checks pass; record actual deployed SHA.
- No external outreach, paid ads, or automatic sends in this release.

## Known limitations
- No automated research-to-database importer yet.
- No server-side send endpoint or email compliance enforcement.
- No verified revenue/payments integration.
- The existing prospect guard intentionally rejects advancing into contacted/replied/quoted/won pending an audited backend workflow.
