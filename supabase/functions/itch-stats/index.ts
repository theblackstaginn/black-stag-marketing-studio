import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const BRAND_ID = "956b245e-f60f-4e40-9d5b-0246d947ffb2";
const EXPECTED_USERNAME = "laceleatherarcane";
const ITCH_BASE = "https://api.itch.io";
const ORIGIN = "https://theblackstaginn.github.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

function publishableKey() {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return keys.default || Object.values(keys)[0] || "";
  } catch {
    return "";
  }
}

function itchKey() {
  const key = (Deno.env.get("ITCH_API_KEY") || "").trim();
  if (!key) throw new Error("itch_not_configured");
  return key;
}

function cors(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  if (origin !== ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...cors(req),
    },
  });
}

async function requireOwner(req: Request) {
  const token = /^Bearer (\S+)$/i.exec(req.headers.get("authorization") || "")?.[1];
  const key = publishableKey();
  if (!SUPABASE_URL || !token || !key) throw new Error("not_authorized");

  const client = createClient(SUPABASE_URL, key, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error("not_authorized");

  const { data: brand } = await client
    .from("brands")
    .select("owner_id")
    .eq("id", BRAND_ID)
    .maybeSingle();

  if (brand?.owner_id === user.id) return user.id;

  const { data: membership } = await client
    .from("brand_memberships")
    .select("role")
    .eq("brand_id", BRAND_ID)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role === "owner") return user.id;
  throw new Error("not_authorized");
}

async function itchFetch(path: string) {
  const response = await fetch(ITCH_BASE + path, {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + itchKey(),
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("itch_reauthorization_required");
  }
  if (!response.ok) {
    throw new Error("itch_http_" + response.status);
  }

  const data = await response.json();
  if (Array.isArray(data?.errors) && data.errors.length) {
    throw new Error("itch_api_error");
  }
  return data;
}

function safeText(value: unknown, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function safeHttpsUrl(value: unknown, allowedHostSuffix?: string) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (allowedHostSuffix && !(url.hostname === allowedHostSuffix || url.hostname.endsWith("." + allowedHostSuffix))) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

function nonNegativeInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function cleanEarnings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any) => {
      const currency = safeText(row?.currency, 3).toUpperCase();
      const amount = nonNegativeInt(row?.amount);
      if (!/^[A-Z]{3}$/.test(currency)) return null;
      return {
        currency,
        amount_cents: amount,
        amount_formatted: safeText(row?.amount_formatted, 40),
      };
    })
    .filter(Boolean);
}

function cleanGame(row: any) {
  const id = nonNegativeInt(row?.id);
  if (!id) return null;

  return {
    id,
    title: safeText(row?.title, 250),
    short_text: safeText(row?.short_text, 1000),
    url: safeHttpsUrl(row?.url, "itch.io"),
    cover_url: safeHttpsUrl(row?.cover_url, "itch.zone"),
    classification: safeText(row?.classification, 50),
    type: safeText(row?.type, 50),
    published: row?.published === true,
    created_at: safeText(row?.created_at, 50),
    published_at: safeText(row?.published_at, 50),
    views_count: nonNegativeInt(row?.views_count),
    downloads_count: nonNegativeInt(row?.downloads_count),
    purchases_count: nonNegativeInt(row?.purchases_count),
    min_price_cents: nonNegativeInt(row?.min_price),
    earnings: cleanEarnings(row?.earnings),
  };
}

function totals(games: any[]) {
  const earnings = new Map<string, number>();
  let views = 0, downloads = 0, purchases = 0, published = 0;

  for (const game of games) {
    views += game.views_count;
    downloads += game.downloads_count;
    purchases += game.purchases_count;
    if (game.published) published += 1;
    for (const row of game.earnings) {
      earnings.set(row.currency, (earnings.get(row.currency) || 0) + row.amount_cents);
    }
  }

  return {
    projects: games.length,
    published_projects: published,
    views,
    downloads,
    purchases,
    earnings: [...earnings.entries()].map(([currency, amount_cents]) => ({ currency, amount_cents })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const headers = cors(req);
    if (req.headers.get("origin") && !headers["Access-Control-Allow-Origin"]) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET") return json(req, { ok: false, error: "method_not_allowed" }, 405);
  if (req.headers.get("origin") && req.headers.get("origin") !== ORIGIN) {
    return json(req, { ok: false, error: "origin_denied" }, 403);
  }

  try {
    await requireOwner(req);

    const [profileData, gamesData] = await Promise.all([
      itchFetch("/profile"),
      itchFetch("/profile/games"),
    ]);

    const username = safeText(profileData?.user?.username, 100).toLowerCase();
    if (username !== EXPECTED_USERNAME) throw new Error("itch_account_mismatch");

    const games = (Array.isArray(gamesData?.games) ? gamesData.games : [])
      .map(cleanGame)
      .filter(Boolean)
      .sort((a: any, b: any) => Number(b.published) - Number(a.published) || b.views_count - a.views_count);

    return json(req, {
      ok: true,
      account: {
        username,
        display_name: safeText(profileData?.user?.display_name, 200),
        url: safeHttpsUrl(profileData?.user?.url, "itch.io"),
      },
      totals: totals(games),
      projects: games,
      synced_at: new Date().toISOString(),
      source: "itch.io modern server API",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_unavailable";
    const known = new Set([
      "not_authorized",
      "itch_not_configured",
      "itch_reauthorization_required",
      "itch_account_mismatch",
      "itch_api_error",
    ]);
    const code = known.has(message) || message.startsWith("itch_http_") ? message : "server_unavailable";
    if (code === "server_unavailable") console.error("itch-stats internal error");
    const status = code === "not_authorized" ? 403
      : code === "itch_not_configured" ? 503
      : code === "itch_account_mismatch" ? 409
      : 502;
    return json(req, { ok: false, error: code }, status);
  }
});
