# Black Stag Marketing Studio — Read-Only MCP Bridge

This folder is an isolated Phase 1 bridge between ChatGPT and the live Marketing Studio data.

## Security model

- Read-only MCP tools only.
- No insert, update, delete, RPC, SQL, storage mutation, or publishing tools.
- Uses the Supabase anon key, never the service-role key.
- Two authentication checks are required on the MCP endpoint: a private bridge token in `X-Black-Stag-Token` and the signed-in owner's Supabase access token in `Authorization: Bearer <token>`.
- Secrets are environment variables and must never be committed.
- Existing GitHub Pages Studio files are not modified by this bridge.

## Tools

- `list_brands`
- `get_brand_brain`
- `list_campaigns`
- `list_content`
- `list_calendar`
- `list_assets`

## Environment

Copy `.env.example` to a local `.env` (do not commit it) and set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MCP_BEARER_TOKEN` — generate a long random secret
- `PORT` — defaults to 3000

The Supabase anon key is intentionally used so database RLS remains the authorization boundary. Each MCP request must also carry a valid Supabase user access token; the bridge verifies that token with Supabase and creates a request-scoped client carrying the user's JWT. This means `auth.uid()` and the existing `owns_brand(...)` RLS checks continue to decide which rows are readable. Do not substitute the service-role key.

## Run

```bash
npm install
npm start
```

The MCP endpoint is `POST /mcp`. A basic unauthenticated health check is available at `GET /health`.

## Authentication

Every MCP request must include both:

- `X-Black-Stag-Token: <MCP_BEARER_TOKEN>`
- `Authorization: Bearer <current Supabase user access token>`

The bridge validates the Supabase token with `auth.getUser()` before any MCP tool is available. Database reads then run through a request-scoped Supabase client carrying that same user token, so the existing `auth.uid()` / `owns_brand(...)` RLS policies remain authoritative.

The server does not store the user's password or a Supabase service-role key.

Supabase access tokens expire. For local Phase 1 testing, provide a current token from an authenticated Studio session. Before permanent deployment, use an OAuth/session handoff that can refresh credentials rather than storing a long-lived user token.
