# Meta Ads integration

Status: secure bridge deployed; awaiting Meta developer-app credentials and owner authorization.

## Purpose

Connect Black Stag Web Design's Meta/Facebook advertising account to Black Stag Marketing Studio without exposing Meta access tokens to browser code, GitHub, or ChatGPT.

The first authorization is intentionally read-only. It requests only `ads_read` and supports account discovery. It does not create, edit, publish, pause, boost, or fund ads.

## Owner flow

1. Sign in to Black Stag Marketing Studio.
2. Open `meta-connect.html` while Black Stag Web Design is the active brand.
3. Select **Connect Meta account**.
4. Meta handles login and consent on its own domain.
5. Meta redirects to the exact callback:
   `https://theblackstaginn.github.io/black-stag-marketing-studio/meta-connect.html`
6. The page immediately removes the authorization code and state from browser history, then sends them to the authenticated Edge Function.
7. The Edge Function exchanges the code server-side, validates the returned token, exchanges it for a long-lived user token, encrypts it with AES-256-GCM, and stores only the encrypted credential.
8. The browser can request a sanitized list of accessible ad accounts. The browser never receives the OAuth token or app secret.

## Backend

- Supabase Edge Function: `meta-oauth-bridge`
- Source: `supabase/functions/meta-oauth-bridge/index.ts`
- Function actions: `status`, `start`, `finish`, `accounts`, `disconnect`
- Brand scope: Black Stag Web Design only
- Allowed browser origin: `https://theblackstaginn.github.io`
- OAuth state is random, hashed before database storage, owner-bound, single-use, and expires after ten minutes.
- Meta API requests include an app-secret proof where supported.
- Disconnect attempts to revoke the Meta permission and always removes the locally stored encrypted credential.

## Private data

- `public.meta_oauth_attempts`: service-role-only temporary authorization records.
- `public.meta_account_credentials`: service-role-only encrypted Meta credential and safe metadata.
- `public.meta_ad_account_cache`: sanitized owner-readable ad-account metadata.

RLS is enabled on all three tables. Anonymous users cannot read any of them. Authenticated browser users cannot read the credential or OAuth-attempt tables. The ad-account cache is readable only through the existing brand-ownership RLS check.

## Required Supabase secrets

Set these in **Supabase > Edge Functions > Secrets**:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_GRAPH_VERSION`

The bridge derives a Meta-specific encryption key from `META_TOKEN_ENCRYPTION_KEY` when present, otherwise from the existing Pinterest or Etsy token-encryption root. Never place any of these secret values in GitHub or chat.

## Required Meta app configuration

Create or open a Meta developer app owned by Black Stag, enable the Meta products required for Facebook Login and Marketing API access, and register the exact callback URL above.

Use the Graph API version shown as supported in the Meta app dashboard and save it as `META_GRAPH_VERSION`. Do not hard-code a guessed version in the public client.

For the first owner-only test, request only `ads_read`. If future write functionality is approved, add write permissions as a separate, explicit authorization upgrade instead of silently expanding the original token.

## Safety boundary

The current bridge is **read-only by design**. A later campaign-management layer must use a separate approval path before requesting write permissions or enabling ad spend.
