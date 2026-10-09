import test from "node:test";
import assert from "node:assert/strict";
import { submitOAuthEmberReply } from "../ember-return.js";

function sampleRun(overrides = {}) {
  return {
    id: "request-1",
    owner_id: "owner-1",
    brand_id: "brand-1",
    request_type: "manual_handoff",
    status: "pending",
    response_text: null,
    authorization_context: {
      source: "black_stag_marketing_studio",
      mode: "user_initiated_manual_handoff",
      consequential_write_authorized: false
    },
    ...overrides
  };
}

function fakeDb({
  run = sampleRun(),
  allowedBrand = "brand-1",
  authenticatedOwner = "owner-1",
  beforeUpdate
} = {}) {
  const state = { run, updates: 0 };
  const supabase = {
    from(table) {
      const filters = [];
      let patch;
      return {
        select() { return this; },
        update(value) { patch = value; return this; },
        eq(field, value) { filters.push([field, value]); return this; },
        is(field, value) { filters.push([field, value]); return this; },
        async maybeSingle() {
          if (patch && beforeUpdate) beforeUpdate(state);
          let rows = table === "brands" ? [{ id: allowedBrand }] :
            table === "ember_agent_runs" ? [state.run] : [];
          if (table === "ember_agent_runs") {
            rows = rows.filter((row) => row.owner_id === authenticatedOwner);
          }
          const row = rows.find((item) =>
            item && filters.every(([field, value]) => item[field] === value)
          );
          if (!row) return { data: null, error: null };
          if (patch) { Object.assign(row, patch); state.updates++; }
          return { data: { ...row }, error: null };
        }
      };
    }
  };
  return { supabase, state };
}

function invoke(db, overrides = {}) {
  return submitOAuthEmberReply({
    supabase: db.supabase,
    authenticatedUser: { id: "owner-1" },
    requestId: "request-1",
    brandId: "brand-1",
    responseText: "Bridge test confirmed",
    now: () => "2026-10-09T00:00:00.000Z",
    ...overrides
  });
}

test("valid owner and originating brand: save one reply", async () => {
  const db = fakeDb();
  const result = await invoke(db);
  assert.deepEqual(result, {
    saved: true, request_id: "request-1", brand_id: "brand-1",
    status: "answered", responded_at: "2026-10-09T00:00:00.000Z"
  });
  assert.equal(db.state.run.response_text, "Bridge test confirmed");
  assert.equal(db.state.updates, 1);
});

test("already answered: block duplicate reply", async () => {
  const db = fakeDb({ run: sampleRun({ status: "answered", response_text: "Prior answer" }) });
  await assert.rejects(invoke(db), /no longer awaiting/);
  assert.equal(db.state.updates, 0);
});

test("other brand: deny request", async () => {
  const db = fakeDb();
  await assert.rejects(invoke(db, { brandId: "brand-2" }), /unavailable/);
  assert.equal(db.state.updates, 0);
});

test("other owner: deny request", async () => {
  const db = fakeDb({ authenticatedOwner: "owner-2" });
  await assert.rejects(
    invoke(db, { authenticatedUser: { id: "owner-2" } }),
    /No matching Ember handoff/
  );
  assert.equal(db.state.updates, 0);
});

test("not a manual handoff: deny request", async () => {
  const db = fakeDb({ run: sampleRun({ request_type: "general" }) });
  await assert.rejects(invoke(db), /not an eligible/);
  assert.equal(db.state.updates, 0);
});

test("untrusted handoff context: deny request", async () => {
  const db = fakeDb({ run: sampleRun({ authorization_context: { source: "other_app" } }) });
  await assert.rejects(invoke(db), /not an eligible/);
  assert.equal(db.state.updates, 0);
});

test("empty reply: deny write", async () => {
  const db = fakeDb();
  await assert.rejects(invoke(db, { responseText: "  " }), /between 1 and 50000/);
  assert.equal(db.state.updates, 0);
});

test("concurrent cancellation: conditional write cannot overwrite", async () => {
  const db = fakeDb({ beforeUpdate: (state) => { state.run.status = "cancelled"; } });
  await assert.rejects(invoke(db), /not stored/);
  assert.equal(db.state.updates, 0);
  assert.equal(db.state.run.status, "cancelled");
});
