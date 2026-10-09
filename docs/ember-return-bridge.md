# Ember ↔ Marketing Studio: manual return bridge

## Current state (October 8, 2026)

This is a **user-initiated, manually shared** round trip. It provides a fallback while automatic Workspace Agent triggering remains unavailable (the last attempts reported HTTP 409). The return path must pass an authenticated end-to-end phone test before being marked complete.

## Working parts

- Browser: `studio-power-tools.js` powers **Ember → Daily Brief → Ask Ember**. It prepares a scoped run, then exposes independent **Share to ChatGPT** / **Copy handoff** controls. This two-tap sequence allows the iPhone's share sheet to open within a direct click handler.
- Backend: `supabase/functions/prepare-ember-handoff/index.ts`, deployed as the JWT-protected function `prepare-ember-handoff`. It verifies the caller's Supabase identity and permission to read the selected brand; creates one pending `public.ember_agent_runs` row using the authenticated identity; returns only its ID and a one-request HMAC return capability.
- ChatGPT: the shared handoff includes the user instruction, originating brand and record, and `BSMS_RETURN_LANE` parameters. The assistant must call **Ember Return Lane → submit_ember_response** with the matching request ID/capability and a plain-text outcome. This return tool is scoped to writing a response to a single open run, not to changing arbitrary Studio data.
- Studio: **Check for reply** reads the existing owner-protected `ember_agent_runs` row for the selected brand. Reopening the Ember Brief also attempts a check. The returned answer appears inside the same Ember panel.
- Recovery: only the run ID is retained in browser local storage per brand. The handoff text/capability stays in memory and can be reshared during the same session. Reloading discards the capability intentionally; users who have not shared it can start a new run.

## Security boundaries

- The Edge Function uses the caller's bearer token, Supabase user lookup, and brand RLS before creating the run.
- Return capability is derived from the existing return-lane secret for that request ID and is never stored in a database row, local storage, or URL.
- The user must actively share or paste the handoff in ChatGPT. The bridge does **not** invoke an agent automatically.
- Only the returned response is stored through the Return Lane. Publishing, emailing, scheduling, or editing other Studio records requires a separate supported user-authorized action.
- The handoff is private internal context; do not share it publicly.

## Owner acceptance test (not yet performed)

1. Open BSMS as the authorized owner, select Black Stag Web Design, then open **Ember → Daily Brief**.
2. Enter a harmless prompt such as `Return to Studio: Ember bridge test successful.` and press **Prepare handoff**.
3. Use **Share to ChatGPT**. If unavailable, use **Copy handoff** and paste it into ChatGPT.
4. Confirm ChatGPT has access to **Ember Return Lane**, send the complete handoff, and wait for the assistant to submit its response using the included request/capability.
5. Go back to BSMS, tap **Check for reply**, and confirm the answer appears in the panel. Reload the app and confirm it can fetch the same answer using the saved run ID.
6. Test cancel/re-share and brand switching to ensure requests are never shown under a different brand.

If a run fails, inspect only its status and error details; do not copy secret return capabilities into logs or tickets.

## Version notes

- Web app is cache-busted at `studio-power-tools.js?v=9`.
- The older `trigger-ember-agent` automatic path and existing `ember-return-mcp` remain deployed unchanged.
- This flow has passed static JavaScript syntax/integration checks, but **has not yet passed a live ChatGPT↔Studio round trip**.
