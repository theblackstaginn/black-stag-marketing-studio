# Black Stag Marketing Studio — Read-Only MCP Bridge

This folder is an isolated Phase 1 bridge between ChatGPT and the live Marketing Studio data.

## Security model

- Read-only MCP tools only.
- No insert, update, delete, RPC, SQL, storage mutation, or publishing tools.
- Uses the Supabase anon key, never the service-role key.
- Bearer token required on the MCP endpoint.
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

The Supabase anon key is intentionally used so database RLS remains the authorization boundary. Do not substitute the service-role key.

## Run

```bash
npm install
npm start
```

The MCP endpoint is `POST /mcp`. A basic unauthenticated health check is available at `GET /health`.

## Important authentication note

This Phase 1 skeleton authenticates the MCP caller with a bearer token, but it does not impersonate a Supabase user. If the existing RLS policies require `auth.uid()`, reads may correctly return no rows until the bridge is extended with owner-scoped Supabase authentication. Do not weaken RLS to make the bridge work.
