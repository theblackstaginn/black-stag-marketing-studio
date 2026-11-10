import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const ORIGIN = "https://theblackstaginn.github.io";
const CALLBACK = "https://theblackstaginn.github.io/black-stag-marketing-studio/meta-publisher.html";
const PROJECT = Deno.env.get("SUPABASE_URL") || "";
const BSWD_BRAND_ID = "d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
const STAG_STONE_BRAND_ID = "f2d4ad11-da97-4ede-bd8c-135150cf9ef6";
const ALLOWED_BRANDS = new Set([BSWD_BRAND_ID, STAG_STONE_BRAND_ID]);
const PUBLISH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
];

type AdminClient = ReturnType<typeof admin>;
type MetaConfig = { id: string; secret: string; version: string; encryptionRoot: Uint8Array };

type PageRecord = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id?: string; username?: string } | null;
};

function adminKey(): string {
  const bundle = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (bundle) {
    try {
      const parsed = JSON.parse(bundle);
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function publicKey(): string {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return parsed.default || Object.values(parsed)[0] || "";
  } catch {
    return "";
  }
}
function admin() {
  if (!PROJECT || !adminKey()) throw Error("backend_not_configured");
  return createClient(PROJECT, adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
function config(): MetaConfig {
  const id = (Deno.env.get("META_APP_ID") || "").trim();
  const secret = (Deno.env.get("META_APP_SECRET") || "").trim();
  const version = (Deno.env.get("META_GRAPH_VERSION") || "").trim();
  const root = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || Deno.env.get("PINTEREST_TOKEN_ENCRYPTION_KEY") || Deno.env.get("ETSY_TOKEN_ENCRYPTION_KEY") || "";
  let encryptionRoot: Uint8Array;
  try {
    encryptionRoot = Uint8Array.from(atob(root), (ch) => ch.charCodeAt(0));
  } catch {
    throw Error("meta_secrets_missing");
  }
  if (!/^\d{5,30}$/.test(id) || !secret || secret.length > 500 || !/^v\d{1,2}\.\d$/.test(version) || encryptionRoot.length !== 32) {
    throw Error("meta_secrets_missing");
  }
  return { id, secret, version, encryptionRoot };
}
function graph(cfg: MetaConfig, path: string) {
  return `https://graph.facebook.com/${cfg.version}${path}`;
}
function originHeaders(req: Request): Record<string, string> {
  return req.headers.get("origin") === ORIGIN
    ? {
        "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
        Vary: "Origin",
      }
    : {};
}
function respond(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...originHeaders(req),
    },
  });
}
function raw64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function url64(bytes: Uint8Array) {
  return raw64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromUrl64(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error("invalid_encrypted_token");
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s + "=".repeat((4 - (s.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
}
async function stateHash(state: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function encryptionKey(raw: Uint8Array) {
  const root = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("black-stag-meta-oauth-v1"),
      info: new TextEncoder().encode("meta-credential-token-aes-gcm"),
    },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function seal(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return "v1." + url64(iv) + "." + url64(new Uint8Array(cipher));
}
async function openSealed(stored: string, key: CryptoKey) {
  const [version, iv, cipher] = stored.split(".");
  if (version !== "v1" || !iv || !cipher) throw Error("invalid_encrypted_token");
  const value = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromUrl64(iv) }, key, fromUrl64(cipher));
  return new TextDecoder().decode(value);
}
async function appSecretProof(token: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
function requestedScopes(brandId: string) {
  return brandId === BSWD_BRAND_ID ? [...PUBLISH_SCOPES, "ads_read"] : [...PUBLISH_SCOPES];
}
function cleanBrandId(value: unknown) {
  const id = String(value || "");
  return ALLOWED_BRANDS.has(id) ? id : "";
}
async function authenticatedUser(req: Request) {
  const jwt = /^Bearer (\S+)$/i.exec(req.headers.get("Authorization") || "")?.[1];
  const publishable = publicKey();
  if (!jwt || !publishable) return null;
  const client = createClient(PROJECT, publishable, {
    global: { headers: { Authorization: "Bearer " + jwt } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error } = await client.auth.getUser(jwt);
  return error || !user ? null : user.id;
}
async function ownsBrand(db: AdminClient, userId: string, brandId: string) {
  if (!cleanBrandId(brandId)) return false;
  const { data: brand, error } = await db.from("brands").select("owner_id").eq("id", brandId).maybeSingle();
  if (error || !brand) return false;
  if (brand.owner_id === userId) return true;
  const { data: membership } = await db.from("brand_memberships").select("role").eq("brand_id", brandId).eq("user_id", userId).maybeSingle();
  return membership?.role === "owner";
}
async function authorizedOwner(req: Request, db: AdminClient, brandId: string) {
  const userId = await authenticatedUser(req);
  if (!userId || !(await ownsBrand(db, userId, brandId))) return null;
  return userId;
}
async function status(req: Request, db: AdminClient, input: Record<string, unknown>) {
  const brandId = cleanBrandId(input.brand_id);
  if (!brandId || !(await authorizedOwner(req, db, brandId))) return respond(req, { error: "not_authorized" }, 403);
  let configured = true;
  try { config(); } catch { configured = false; }
  const { data, error } = await db
    .from("meta_account_credentials")
    .select("facebook_user_id,facebook_name,scopes,access_token_expires_at,connected_at")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) return respond(req, { error: "status_unavailable" }, 500);
  const granted = Array.isArray(data?.scopes) ? data.scopes.map(String) : [];
  const missing = PUBLISH_SCOPES.filter((scope) => !granted.includes(scope));
  const expired = data?.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() < Date.now() + 60000 : false;
  return respond(req, {
    configured,
    connected: !!data,
    publisher_ready: !!data && !expired && missing.length === 0,
    missing_scopes: missing,
    account: data ? {
      facebook_user_id: data.facebook_user_id,
      facebook_name: data.facebook_name,
      scopes: granted,
      access_token_expires_at: data.access_token_expires_at,
      connected_at: data.connected_at,
    } : null,
  });
}
async function start(req: Request, db: AdminClient, input: Record<string, unknown>) {
  const brandId = cleanBrandId(input.brand_id);
  const who = brandId ? await authorizedOwner(req, db, brandId) : null;
  if (!brandId || !who) return respond(req, { error: "not_authorized" }, 403);
  const cfg = config();
  const scopes = requestedScopes(brandId);
  const state = url64(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await db.from("meta_oauth_attempts").insert({
    state_hash: await stateHash(state),
    brand_id: brandId,
    initiated_by: who,
    scopes,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  });
  if (error) return respond(req, { error: "unable_to_begin_authorization" }, 500);
  const url = new URL("https://www.facebook.com/" + cfg.version + "/dialog/oauth");
  url.searchParams.set("client_id", cfg.id);
  url.searchParams.set("redirect_uri", CALLBACK);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("state", state);
  return respond(req, { authorize_url: url.toString(), expires_in: 600 });
}
async function exchangeCode(cfg: MetaConfig, code: string) {
  const url = new URL(graph(cfg, "/oauth/access_token"));
  url.searchParams.set("client_id", cfg.id);
  url.searchParams.set("client_secret", cfg.secret);
  url.searchParams.set("redirect_uri", CALLBACK);
  url.searchParams.set("code", code);
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error("meta_token_exchange_failed");
  return await r.json();
}
async function exchangeLongLived(cfg: MetaConfig, shortToken: string) {
  const url = new URL(graph(cfg, "/oauth/access_token"));
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", cfg.id);
  url.searchParams.set("client_secret", cfg.secret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error("meta_long_lived_exchange_failed");
  return await r.json();
}
async function debugToken(cfg: MetaConfig, token: string) {
  const url = new URL(graph(cfg, "/debug_token"));
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", cfg.id + "|" + cfg.secret);
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error("meta_token_validation_failed");
  return await r.json();
}
async function readMe(cfg: MetaConfig, token: string) {
  const url = new URL(graph(cfg, "/me"));
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", token);
  url.searchParams.set("appsecret_proof", await appSecretProof(token, cfg.secret));
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error("meta_account_verification_failed");
  return await r.json();
}
async function finish(req: Request, db: AdminClient, input: Record<string, unknown>) {
  const who = await authenticatedUser(req);
  if (!who) return respond(req, { error: "not_authorized" }, 403);
  const state = String(input.state || "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return respond(req, { error: "invalid_state" }, 400);
  const { data: attempts, error } = await db
    .from("meta_oauth_attempts")
    .delete()
    .eq("state_hash", await stateHash(state))
    .gt("expires_at", new Date().toISOString())
    .select("brand_id,initiated_by,scopes");
  if (error || !attempts || attempts.length !== 1) return respond(req, { error: "authorization_expired_or_reused" }, 400);
  const attempt = attempts[0];
  const brandId = cleanBrandId(attempt.brand_id);
  if (!brandId || attempt.initiated_by !== who || !(await ownsBrand(db, who, brandId))) {
    return respond(req, { error: "authorization_owner_mismatch" }, 403);
  }
  if (input.error) return respond(req, { error: "authorization_declined" }, 400);
  const code = String(input.code || "");
  if (!code || code.length > 4000) return respond(req, { error: "authorization_code_missing" }, 400);
  const cfg = config();
  const short = await exchangeCode(cfg, code);
  if (typeof short.access_token !== "string") throw Error("meta_token_response_incomplete");
  const longLived = await exchangeLongLived(cfg, short.access_token);
  if (typeof longLived.access_token !== "string") throw Error("meta_token_response_incomplete");
  const debug = await debugToken(cfg, longLived.access_token);
  const data = debug?.data;
  if (!data?.is_valid || String(data.app_id || "") !== cfg.id) throw Error("meta_token_validation_failed");
  const granted = Array.isArray(data.scopes) ? data.scopes.map(String) : [];
  const expected = Array.isArray(attempt.scopes) ? attempt.scopes.map(String) : requestedScopes(brandId);
  const missing = expected.filter((scope) => !granted.includes(scope));
  if (missing.length) return respond(req, { error: "meta_permissions_incomplete", missing_scopes: missing }, 403);
  const profile = await readMe(cfg, longLived.access_token);
  const facebookUserId = String(profile?.id || "");
  const facebookName = String(profile?.name || "").slice(0, 160);
  if (!/^\d{5,30}$/.test(facebookUserId)) throw Error("meta_account_verification_failed");
  let expiresAt: string;
  if (Number.isFinite(Number(data.expires_at)) && Number(data.expires_at) > 0) {
    expiresAt = new Date(Number(data.expires_at) * 1000).toISOString();
  } else {
    const sec = Number(longLived.expires_in);
    if (!Number.isFinite(sec) || sec < 60 || sec > 90 * 86400) throw Error("unexpected_token_expiry");
    expiresAt = new Date(Date.now() + sec * 1000).toISOString();
  }
  const key = await encryptionKey(cfg.encryptionRoot);
  const encrypted = await seal(longLived.access_token, key);
  const { error: saveError } = await db.from("meta_account_credentials").upsert({
    brand_id: brandId,
    facebook_user_id: facebookUserId,
    facebook_name: facebookName || null,
    access_token_encrypted: encrypted,
    scopes: granted,
    access_token_expires_at: expiresAt,
    authorized_by: who,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "brand_id" });
  if (saveError) throw Error("unable_to_save_connection");
  return respond(req, {
    connected: true,
    publisher_ready: PUBLISH_SCOPES.every((scope) => granted.includes(scope)),
    brand_id: brandId,
    facebook_name: facebookName || null,
    scopes: granted,
    access_token_expires_at: expiresAt,
  });
}
async function validToken(db: AdminClient, brandId: string) {
  const { data: row, error } = await db
    .from("meta_account_credentials")
    .select("access_token_encrypted,access_token_expires_at,scopes")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error || !row) throw Error("not_connected");
  if (new Date(row.access_token_expires_at).getTime() < Date.now() + 60000) throw Error("reauthorization_required");
  const granted = Array.isArray(row.scopes) ? row.scopes.map(String) : [];
  if (!PUBLISH_SCOPES.every((scope) => granted.includes(scope))) throw Error("publisher_reauthorization_required");
  const cfg = config();
  const key = await encryptionKey(cfg.encryptionRoot);
  return { token: await openSealed(row.access_token_encrypted, key), cfg };
}
async function metaGet(cfg: MetaConfig, token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(graph(cfg, path));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", token);
  url.searchParams.set("appsecret_proof", await appSecretProof(token, cfg.secret));
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18000) });
  const body = await r.json().catch(() => null);
  if (!r.ok || body?.error) {
    const code = Number(body?.error?.code);
    if (code === 190 || r.status === 401) throw Error("reauthorization_required");
    throw Error("meta_request_failed");
  }
  return body;
}
async function metaPost(cfg: MetaConfig, token: string, path: string, params: Record<string, string>) {
  const form = new URLSearchParams(params);
  form.set("access_token", token);
  form.set("appsecret_proof", await appSecretProof(token, cfg.secret));
  const r = await fetch(graph(cfg, path), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok || body?.error) {
    const code = Number(body?.error?.code);
    if (code === 190 || r.status === 401) throw Error("reauthorization_required");
    console.error("Meta publish request failed", { path, status: r.status, code: code || null, subcode: body?.error?.error_subcode || null });
    throw Error("meta_publish_failed");
  }
  return body;
}
async function fetchPages(cfg: MetaConfig, token: string): Promise<PageRecord[]> {
  const result = await metaGet(cfg, token, "/me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });
  const rows = Array.isArray(result?.data) ? result.data : [];
  return rows
    .map((item: Record<string, unknown>) => ({
      id: String(item.id || ""),
      name: String(item.name || "Untitled Page").slice(0, 160),
      access_token: typeof item.access_token === "string" ? item.access_token : undefined,
      instagram_business_account: item.instagram_business_account && typeof item.instagram_business_account === "object"
        ? {
            id: String((item.instagram_business_account as Record<string, unknown>).id || ""),
            username: String((item.instagram_business_account as Record<string, unknown>).username || "").slice(0, 80),
          }
        : null,
    }))
    .filter((item: PageRecord) => /^\d{5,30}$/.test(item.id));
}
async function pages(req: Request, db: AdminClient, input: Record<string, unknown>) {
  const brandId = cleanBrandId(input.brand_id);
  if (!brandId || !(await authorizedOwner(req, db, brandId))) return respond(req, { error: "not_authorized" }, 403);
  const { token, cfg } = await validToken(db, brandId);
  const all = await fetchPages(cfg, token);
  const sanitized = all.map((page) => ({
    id: page.id,
    name: page.name,
    instagram: page.instagram_business_account?.id
      ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username || null }
      : null,
  }));
  return respond(req, { pages: sanitized, count: sanitized.length });
}
function safeHttpUrl(value: unknown, httpsOnly = false) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (httpsOnly ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}
function obviousNonJpeg(value: string) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return /\.(png|webp|gif|bmp|tiff?|avif|heic|heif)$/.test(pathname);
  } catch {
    return false;
  }
}
function captionWithLink(message: string, link: string) {
  if (!link) return message;
  if (!message) return link;
  return message.includes(link) ? message : `${message}\n\n${link}`;
}
async function publish(req: Request, db: AdminClient, input: Record<string, unknown>) {
  const brandId = cleanBrandId(input.brand_id);
  const who = brandId ? await authorizedOwner(req, db, brandId) : null;
  if (!brandId || !who) return respond(req, { error: "not_authorized" }, 403);
  if (input.confirm !== "PUBLISH_NOW") return respond(req, { error: "explicit_confirmation_required" }, 400);

  const pageId = String(input.page_id || "");
  if (!/^\d{5,30}$/.test(pageId)) return respond(req, { error: "invalid_page" }, 400);
  const rawTargets = Array.isArray(input.targets) ? input.targets.map(String) : [];
  const targets = Array.from(new Set(rawTargets.filter((t) => t === "facebook" || t === "instagram")));
  if (!targets.length || targets.length > 2) return respond(req, { error: "invalid_targets" }, 400);

  const message = String(input.message || "");
  if (message.length > 2200) return respond(req, { error: "message_too_long", max: 2200 }, 400);
  const link = input.link ? safeHttpUrl(input.link) : "";
  if (input.link && !link) return respond(req, { error: "invalid_link" }, 400);
  const imageUrl = input.image_url ? safeHttpUrl(input.image_url, true) : "";
  if (input.image_url && !imageUrl) return respond(req, { error: "invalid_image_url" }, 400);
  if (targets.includes("instagram") && !imageUrl) return respond(req, { error: "instagram_image_required" }, 400);
  if (targets.includes("instagram") && obviousNonJpeg(imageUrl)) return respond(req, { error: "instagram_jpeg_required" }, 400);
  if (targets.includes("facebook") && !message.trim() && !link && !imageUrl) return respond(req, { error: "facebook_content_required" }, 400);

  const { token, cfg } = await validToken(db, brandId);
  const allPages = await fetchPages(cfg, token);
  const page = allPages.find((candidate) => candidate.id === pageId);
  if (!page?.access_token) return respond(req, { error: "page_not_accessible" }, 403);
  const pageToken = page.access_token;
  const results: Record<string, unknown> = {};

  if (targets.includes("facebook")) {
    try {
      let result;
      if (imageUrl) {
        result = await metaPost(cfg, pageToken, `/${pageId}/photos`, {
          url: imageUrl,
          caption: captionWithLink(message, link),
          published: "true",
        });
      } else {
        const payload: Record<string, string> = { message, published: "true" };
        if (link) payload.link = link;
        result = await metaPost(cfg, pageToken, `/${pageId}/feed`, payload);
      }
      results.facebook = { ok: true, id: String(result?.post_id || result?.id || "") || null };
    } catch (error) {
      results.facebook = { ok: false, error: error instanceof Error ? error.message : "facebook_publish_failed" };
    }
  }

  if (targets.includes("instagram")) {
    const igId = String(page.instagram_business_account?.id || "");
    if (!/^\d{5,30}$/.test(igId)) {
      results.instagram = { ok: false, error: "instagram_account_not_linked" };
    } else {
      try {
        const container = await metaPost(cfg, pageToken, `/${igId}/media`, {
          image_url: imageUrl,
          caption: captionWithLink(message, link),
        });
        const creationId = String(container?.id || "");
        if (!/^\d{5,30}$/.test(creationId)) throw Error("instagram_container_failed");
        const published = await metaPost(cfg, pageToken, `/${igId}/media_publish`, { creation_id: creationId });
        results.instagram = { ok: true, id: String(published?.id || "") || null };
      } catch (error) {
        results.instagram = { ok: false, error: error instanceof Error ? error.message : "instagram_publish_failed" };
      }
    }
  }

  const values = Object.values(results) as Array<{ ok?: boolean }>;
  const successes = values.filter((value) => value?.ok).length;
  return respond(req, {
    ok: successes === values.length,
    partial: successes > 0 && successes < values.length,
    page: { id: page.id, name: page.name },
    results,
    published_at: new Date().toISOString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: originHeaders(req) });
  if (req.method !== "POST") return respond(req, { error: "method_not_allowed" }, 405);
  if (req.headers.get("origin") && req.headers.get("origin") !== ORIGIN) return respond(req, { error: "origin_denied" }, 403);
  try {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") return respond(req, { error: "invalid_payload" }, 400);
    const db = admin();
    if (body.action === "status") return await status(req, db, body);
    if (body.action === "start") return await start(req, db, body);
    if (body.action === "finish") return await finish(req, db, body);
    if (body.action === "pages") return await pages(req, db, body);
    if (body.action === "publish") return await publish(req, db, body);
    return respond(req, { error: "invalid_action" }, 400);
  } catch (error) {
    const name = error instanceof Error ? error.message : "server_error";
    const known = [
      "backend_not_configured",
      "meta_secrets_missing",
      "not_connected",
      "reauthorization_required",
      "publisher_reauthorization_required",
      "meta_token_exchange_failed",
      "meta_long_lived_exchange_failed",
      "meta_token_validation_failed",
      "meta_token_response_incomplete",
      "meta_account_verification_failed",
      "unexpected_token_expiry",
      "invalid_encrypted_token",
      "unable_to_save_connection",
      "meta_request_failed",
      "meta_publish_failed",
    ];
    if (!known.includes(name)) console.error("Meta publisher bridge error:", name);
    const statusCode = name === "not_connected" ? 404 : ["reauthorization_required", "publisher_reauthorization_required"].includes(name) ? 403 : 503;
    return respond(req, { error: known.includes(name) ? name : "server_unavailable" }, statusCode);
  }
});
