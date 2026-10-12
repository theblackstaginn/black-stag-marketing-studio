# Black Stag Pinterest Integration — Operational Handoff

## Status (2026-10-12)

**Existing, working today**
- The Pinterest account `laceandleather65` is connected through the user's Metricool brand ID `7141063` (timezone America/New_York).
- Pinterest analytics are accessible via the Metricool plugin inside ChatGPT, without Pinterest credentials in the conversation.
- `public.pinterest_traffic_daily` stores sanitized historical metrics under Lace & Leather brand `956b245e-f60f-4e40-9d5b-0246d947ffb2` with owner-only RLS.
- The existing Studio campaign "Arcane Assets & Commissions" (`a101fc7b-b66a-4a3d-972c-6128898a446c`) contains two Pinterest **drafts only**, for Grimoire and Mapmakers.
- `pinterest-desk.html` shows owner-only saved traffic and draft content. It does **not** post.
- Main Studio dashboard and desktop sidebar have a Lace & Leather-specific Pinterest Desk shortcut; existing mobile navigation was not expanded.
- Two ChatGPT automations are enabled: daily Pinterest metric review/conditional alert and weekly Pinterest draft preparation. These do not publish or schedule pins. Verify actual runs before claiming autonomous updates work.

**Direct Pinterest API bridge — deployed but NOT CONNECTED**
- Supabase Edge Function: `pinterest-oauth-bridge`; custom JWT/owner checks; POST actions `status`, `start`, `finish`, `boards`. No public posting action exists.
- GitHub source: `supabase/functions/pinterest-oauth-bridge/index.ts`.
- Database: `public.pinterest_oauth_attempts` (one-time state, short-lived), `public.pinterest_account_credentials` (encrypted credentials, service-role only), `public.pinterest_board_cache` (sanitized board names, owner-only RLS).
- Configuration page: `pinterest-connect.html`.
- Redirect URI (must match Pinterest app configuration exactly, **never redirect the callback URL**):
  `https://theblackstaginn.github.io/black-stag-marketing-studio/pinterest-connect.html`
- The callback is received by this static page, the code/state are removed from browser history immediately, and the page exchanges the code through the authenticated Supabase Edge Function. No tokens are sent to the public browser.

## First user action required

1. Visit Pinterest Developer Apps: https://developers.pinterest.com/apps/
2. Register an app for the *actual business account* `laceandleather65`. Pinterest may require developer account setup, Trial app review, and later Standard access review.
3. Register the exact HTTPS redirect URI above.
4. In Supabase > Edge Functions > Secrets, enter **PINTEREST_APP_ID** and **PINTEREST_APP_SECRET** from the Pinterest developer console. Never provide values through chat.
5. The bridge derives a distinct AES-256-GCM token encryption key using HKDF from the existing 32-byte `ETSY_TOKEN_ENCRYPTION_KEY`; alternatively `PINTEREST_TOKEN_ENCRYPTION_KEY` takes precedence. Never publish the secret.
6. Open `pinterest-connect.html` using the same browser session as Black Stag Marketing Studio; authorize Pinterest, confirm `@laceandleather65`, and choose **Refresh boards** to read board names.
7. Inspect and verify the data before adding pin-creation functionality.

## Security and publishing guardrails

- The connected Metricool app and Pinterest API are different integrations. Do not equate current Metricool access with direct API authorization.
- Pinterest OAuth scopes requested: `user_accounts:read`, `boards:read`, `pins:read`, `pins:write`. The existence of `pins:write` in OAuth does **not** mean this code can publish; no publishing endpoint is deployed.
- Only owners authorized for the existing Lace & Leather brand may start/finish OAuth. The callback code is one-use with a 10-minute state, and the user must still be signed in.
- Exchange token server-side with Pinterest Basic app authentication, verify username, encrypt at rest and renew access using refresh tokens on read requests. Do not print authorization codes, access/refresh tokens or secret values in logs.
- Pinterest developer Trial access is not sufficient for public Pin publishing. Request Standard access as Pinterest requires.
- Before any live automated posting, build an owner approval queue with board selection, preview, verified Etsy destination, validated image, idempotency key, publish status, and audit log. Do not auto-publish based only on scheduled draft creation.
- The Etsy Aged Parchment/Neutral Bone product identity is not yet resolved. Do **not** advertise those listings as separate verified products until corrected.

## Live dashboard and metrics

- Main Studio: https://theblackstaginn.github.io/black-stag-marketing-studio/
- Pinterest Desk: https://theblackstaginn.github.io/black-stag-marketing-studio/pinterest-desk.html
- Direct Pinterest Connect: https://theblackstaginn.github.io/black-stag-marketing-studio/pinterest-connect.html
- Etsy Sales Desk: https://theblackstaginn.github.io/black-stag-marketing-studio/etsy-dashboard.html

Do not describe direct API setup as complete until Pinterest app credentials, authorization, board sync and publishing approval are verified.