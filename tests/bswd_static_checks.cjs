"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const root = process.cwd();
const read = p => fs.readFileSync(root + "/" + p,"utf8");
const schema=read("supabase/migrations/20261028175959_bswd_prospect_pipeline.sql");
const guards=read("supabase/migrations/20261028180002_bswd_pipeline_guards.sql");
const ui=read("prospect-desk.js");
const html=read("prospect-desk.html");
function requirePattern(text,regex,message){assert.match(text,regex,message);}
for(const table of ["bswd_prospects","bswd_outreach","bswd_prospect_events"]){
 requirePattern(schema,new RegExp("alter table public\\."+table+" enable row level security","i"),table+" must enable RLS");
 requirePattern(schema,new RegExp("alter table public\\."+table+" force row level security","i"),table+" must force RLS");
}
requirePattern(schema,/unique\s*\(owner_id,\s*prospect_key\)/i,"owner-scoped deduplication missing");
requirePattern(schema,/using\s*\(owner_id\s*=\s*\(select auth\.uid\(\)\)\s+and\s+exists/i,"RLS ownership predicate missing");
requirePattern(guards,/old\.suppressed_at is not null/i,"suppression cannot be removed");
requirePattern(guards,/target_suppressed is not null/i,"outreach must respect suppression");
requirePattern(guards,/new\.state not in \('draft','approved','cancelled'\)/i,"browser state gate missing");
requirePattern(guards,/revoke insert,update,delete on public\.bswd_prospect_events from authenticated/i,"audit log must be read-only for browser");
requirePattern(guards,/new\.sent_at is distinct from old\.sent_at/i,"delivery timestamp must not be spoofable");
requirePattern(ui,/client\.auth\.getUser\(\)/,"authenticated user check missing");
requirePattern(ui,/brand\?\.owner_id\s*!==\s*userData\.user\.id/,"brand owner check missing");
requirePattern(ui,/state:"draft"/,"outreach inserts must start as drafts");
assert.doesNotMatch(ui,/fetch\([^)]*send|sendEmail\s*\(/i,"unexpected sending implementation");
assert.doesNotMatch(ui,/\.functions\.invoke\((?!["\x27]bswd-site-verifier["\x27])/i,"only the read-only website verifier may be invoked");
requirePattern(html,/noindex,nofollow/i,"prospect page must not be indexed");
requirePattern(ui,/function hasEmail\(p\)/,"email contact detection missing");
requirePattern(ui,/contact_channel,contact_value,stage/,"public contact value must be queried for the desk");
requirePattern(ui,/emailOnly/,"email-only list filter missing");
requirePattern(html,/id="emailOnly"/,"email-only toggle missing");
requirePattern(html,/id="contactEmail"/,"public contact email input missing");
requirePattern(html,/prospect-desk\.js\?v=4/,"updated JS cache bust missing");
for (const name of ["prospects", "outreach", "events"]) {
 const policy = schema.split('create policy "owner access ' + name + '"')[1]?.split(';')[0] || "";
 for (const clause of ["using", "with check"]) {
  const predicate=policy.split(clause)[1]?.split('with check')[0] || "";
  requirePattern(predicate, /owner_id = \(select auth\.uid\(\)\) and exists/i, name + " owner predicate missing");
  requirePattern(predicate, /b\.id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b' and b\.owner_id = \(select auth\.uid\(\)\)/i, name + " BSWD brand predicate missing");
 }
}
const targeting=read("supabase/migrations/20261031042550_bswd_email_verified_website_gap_focus.sql");
const discovery=read("supabase/migrations/20261031043600_bswd_site_search_checks.sql");
const verifier=read("supabase/functions/bswd-site-verifier/index.ts");
requirePattern(targeting,/opportunity_type\s+text/i,"website-gap classification column missing");
requirePattern(targeting,/email_source_url\s+text/i,"email source evidence column missing");
requirePattern(discovery,/enable row level security/i,"site search records require RLS");
requirePattern(discovery,/force row level security/i,"site search records require FORCE RLS");
requirePattern(discovery,/revoke all on public.bswd_site_search_checks from authenticated/i,"browser must not write automated evidence");
requirePattern(ui,/from\("bswd_site_search_checks"\)/,"automated site check readback missing");
requirePattern(ui,/functions\.invoke\("bswd-site-verifier"/,"automatic site check invocation missing");
requirePattern(ui,/void verifyDue\(2\)/,"initial automatic website check missing");
requirePattern(ui,/await verifySite\(createdProspect\)/,"new business automatic website check missing");
requirePattern(ui,/no_clear_site_found/,"search uncertainty classification missing");
requirePattern(html,/id="verifyNext"/,"owner batch check control missing");
requirePattern(html,/id="verifyStatus"/,"search progress field missing");
requirePattern(verifier,/\/auth\/v1\/user/,"verifier must authenticate caller");
requirePattern(verifier,/bswd_owner_only/,"verifier must enforce primary BSWD owner");
requirePattern(verifier,/SUPABASE_SERVICE_ROLE_KEY/,"server-only evidence write key missing");
requirePattern(verifier,/X-Tavily-Access-Mode/,"keyless search mode missing");
assert.doesNotMatch(verifier,/sendEmail|smtp|resend\.emails|outreach\.insert/i,"site checker must never send outreach");
console.log("PASS: prospect desk static security contracts (not a substitute for database integration tests)");
