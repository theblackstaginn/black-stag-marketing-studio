import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Manual, owner-initiated BSMS -> ChatGPT -> BSMS return lane.
 * No automatic agent trigger, autonomous work, or consequential writes.
 * A one-request HMAC capability allows only submit_ember_response.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const legacy = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!raw) return legacy;
  try {
    return JSON.parse(raw).default || legacy;
  } catch {
    return legacy;
  }
}

async function scopedReturnCapability(secret: string, requestId: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("ember-return:" + requestId),
  );
  return Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const bearer = req.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer ")) {
    return json({ error: "authentication_required" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const apikey = publishableKey();
  const secret = Deno.env.get("CHATGPT_AGENT_ACCESS_TOKEN") || "";
  if (!url || !apikey || !secret) {
    return json({ error: "handoff_server_not_configured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("invalid body");
    }
    body = value as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const brandId = typeof body.brand_id === "string" ? body.brand_id.trim() : "";
  const requestText =
    typeof body.request_text === "string" ? body.request_text.trim() : "";
  const rawContext =
    body.request_context && typeof body.request_context === "object" &&
        !Array.isArray(body.request_context)
      ? body.request_context
      : {};
  const requestContext = JSON.stringify(rawContext);

  if (!uuidPattern.test(brandId)) return json({ error: "invalid_brand_id" }, 400);
  if (!requestText || requestText.length > 12000) {
    return json({ error: "request_text_out_of_range" }, 400);
  }
  if (requestContext.length > 22000) {
    return json({ error: "request_context_too_long" }, 413);
  }

  // Verify the JWT and brand visibility using the caller's credentials.
  const authHeaders = {
    apikey,
    Authorization: bearer,
    "Content-Type": "application/json",
  };
  const me = await fetch(url + "/auth/v1/user", { headers: authHeaders });
  if (!me.ok) return json({ error: "authentication_required" }, 401);
  const user = await me.json();
  if (!uuidPattern.test(String(user?.id || ""))) {
    return json({ error: "authentication_required" }, 401);
  }

  // brands SELECT RLS enforces owner or authorized co-owner access.
  const brand = await fetch(
    url + "/rest/v1/brands?select=id&id=eq." + encodeURIComponent(brandId) + "&limit=1",
    { headers: authHeaders },
  );
  if (!brand.ok) return json({ error: "brand_access_check_failed" }, 502);
  const accessibleBrands = await brand.json();
  if (!Array.isArray(accessibleBrands) || accessibleBrands.length !== 1) {
    return json({ error: "brand_access_denied" }, 403);
  }

  const insertedResponse = await fetch(url + "/rest/v1/ember_agent_runs", {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: user.id,
      brand_id: brandId,
      request_type: "manual_handoff",
      request_text: requestText,
      request_context: rawContext,
      authorization_context: {
        source: "black_stag_marketing_studio",
        mode: "user_initiated_manual_handoff",
        consequential_write_authorized: false,
      },
      status: "pending",
    }),
  });

  if (!insertedResponse.ok) {
    console.error("Handoff run insert failed", insertedResponse.status);
    return json({ error: "handoff_record_failed" }, 500);
  }

  const inserted = await insertedResponse.json();
  const run = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!uuidPattern.test(String(run?.id || ""))) {
    return json({ error: "handoff_record_failed" }, 500);
  }

  // This capability is returned to the signed-in requestor once.
  // It is NOT persisted in the database, URL, or server logs.
  const capability = await scopedReturnCapability(secret, run.id);
  return json({
    ok: true,
    mode: "manual",
    status: "pending",
    run_id: run.id,
    return_capability: capability,
  }, 201);
});
