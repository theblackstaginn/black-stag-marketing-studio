"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const root = process.cwd();
const read = p => fs.readFileSync(root + "/" + p,"utf8");
const schema=read("supabase/migrations/20261028_bswd_prospect_pipeline.sql");
const guards=read("supabase/migrations/20261028_bswd_pipeline_guards.sql");
const ui=read("prospect-desk.js");
const html=read("prospect-desk.html");
function requirePattern(text,regex,message){assert.match(text,regex,message);}
for(const table of ["bswd_prospects","bswd_outreach","bswd_prospect_events"]){
 requirePattern(schema,new RegExp("alter table public\\."+table+" enable row level security","i"),table+" must enable RLS");
 requirePattern(schema,new RegExp("alter table public\\."+table+" force row level security","i"),table+" must force RLS");
}
requirePattern(schema,/unique\s*\(owner_id,\s*prospect_key\)/i,"owner-scoped deduplication missing");
requirePattern(schema,/using\s*\(owner_id\s*=\s*\(select auth\.uid\(\)\)\)/i,"RLS ownership predicate missing");
requirePattern(guards,/old\.suppressed_at is not null/i,"suppression cannot be removed");
requirePattern(guards,/target_suppressed is not null/i,"outreach must respect suppression");
requirePattern(guards,/new\.state not in \('draft','approved','cancelled'\)/i,"browser state gate missing");
requirePattern(guards,/revoke insert,update,delete on public\.bswd_prospect_events from authenticated/i,"audit log must be read-only for browser");
requirePattern(guards,/new\.sent_at is distinct from old\.sent_at/i,"delivery timestamp must not be spoofable");
requirePattern(ui,/client\.auth\.getUser\(\)/,"authenticated user check missing");
requirePattern(ui,/brand\?\.owner_id\s*!==\s*userData\.user\.id/,"brand owner check missing");
requirePattern(ui,/state:"draft"/,"outreach inserts must start as drafts");
assert.doesNotMatch(ui,/\.functions\.invoke\(|fetch\([^)]*send|sendEmail\s*\(/i,"unexpected sending implementation");
requirePattern(html,/noindex,nofollow/i,"prospect page must not be indexed");
console.log("PASS: prospect desk static security contracts (not a substitute for database integration tests)");
