# Pinterest ⇄ Etsy Automation — Lace & Leather

Status: **Metricool connected, analytics workspace built, draft creation active, direct Pinterest API not yet authorized.**  
Updated: 2026-10-12

## Connected services

- Black Stag Marketing Studio brand: Lace & Leather, ID `956b245e-f60f-4e40-9d5b-0246d947ffb2`
- Studio campaign: Arcane Assets & Commissions, ID `a101fc7b-b66a-4a3d-972c-6128898a446c`
- Pinterest account: `laceandleather65`; connected through Metricool brand `7141063` (America/New_York).
- Etsy shop: `laceLeatherArcane`; privately connected via Supabase Etsy OAuth and read-only data snapshot.
- Primary dashboard: `pinterest-desk.html` on this GitHub Pages site.
- Etsy shop dashboard: `etsy-dashboard.html`.

## Working functionality

1. Metricool tools in ChatGPT can retrieve Pinterest metrics and schedule posts, subject to the Metricool plan and account board requirements.
2. `public.pinterest_traffic_daily` stores individual daily Pinterest impressions, Pin clicks, outbound clicks, saves, and last sync date under brand RLS.
3. `pinterest-desk.html` shows the saved traffic trend and Pinterest drafts. The page uses the browser's existing Supabase Marketing Studio session; no service-role credentials or Pinterest login details appear in public source.
4. Two unpublished campaign drafts exist in BSMS: Grimoire Textures and Mapmakers Series, each linking to its exact Etsy listing.
5. The ChatGPT recurring task "Lace & Leather Pinterest Watch" is configured to check metrics daily, sync supported daily data, and notify only about important changes; first scheduled run pending.
6. The recurring task "Weekly Pinterest Pin Drafts" is configured to prepare up to two nonduplicate DRAFT pins in Studio on Mondays; first run pending.
7. A context-sensitive Pinterest Desk link appears in the Studio sidebar when Lace & Leather is selected. Etsy dashboard also links to Pinterest Desk.

## Attribution and content rules

- Pinterest Pins should link directly to the relevant active Etsy listing, not just the storefront homepage.
- Prioritize **outbound clicks** and downstream orders over raw impressions.
- Audit artwork ownership, actual download contents, board, title, destination URL and scheduled date before publishing.
- Do not market the duplicate Aged Parchment/Neutral Bone listing pair until the duplicated download and intended naming are resolved.
- Use approved original Lace & Leather art; don't generate vague unrelated "witchy" stock-like imagery.
- Maintain the brand voice: old-world, tactile, arcane and artful. Clear product specs and checkout information take precedence over lore.
- Avoid duplicate Pins, false popularity claims, fabricated discounts or made-up contents.
- Publishing and deletion are not currently automated. Draft creation is not equivalent to publishing.

## No-subscription publishing path

Metricool's MCP connection works on any plan, including Free. Its separate web API requires Advanced or Custom; **do not add a paid Metricool subscription without explicit owner approval**.

For native Supabase-to-Pinterest scheduling without that subscription:

1. Owner must create or gain access to a Pinterest Business developer app: https://developers.pinterest.com/docs/getting-started/connect-app/
2. Seek **Trial** approval first. Pins created through Trial are creator-visible sandbox entities, not public distribution.
3. Build owner-only OAuth authorization-code redirect with secret storage in Supabase, `state` verification and HTTPS callback. Do not expose app secret or tokens in GitHub or chat.
4. Request only necessary scopes (`user_accounts:read`, `boards:read`, `pins:read`, `pins:write`; add `boards:write` only if actual board creation is necessary).
5. Read and validate the actual available boards and Pin destinations after authorization.
6. Provide a live OAuth demo and request **Standard** access. Public posting must wait until approval.
7. Only then implement a queued publisher with idempotency keys, rate-limit handling, bounded retries, audit logs, approval gates and duplicate protection.
8. Verify live Pins and record outbound clicks and attributable Etsy orders; never claim deployment or publication without checking external results.

## Source-of-truth & safeguards

- Do not modify existing working BSMS views, Etsy OAuth functions, or progress to implement Pinterest integration.
- Check `main` branch before editing; commit tested incremental changes.
- Keep the live Etsy catalog read/write abilities separated from Pinterest publishing controls.
- No customer data, Etsy order details or private app credentials are stored in `pinterest_traffic_daily`.
- If Metricool is unavailable during an automation run, skip the write and report an actionable blocker rather than inventing metrics.
