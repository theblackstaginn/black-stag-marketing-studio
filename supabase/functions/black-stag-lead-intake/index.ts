const ALLOWED_ORIGINS = new Set([
  "https://blackstagweb.com",
  "https://www.blackstagweb.com",
]);

const BRAND_ID = "d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
const CAMPAIGN_ID = "261eb42b-bc35-4b18-ac0d-6120b6d7d6b3";
const MAX_BODY_BYTES = 12_000;
const MAX_SUBMISSIONS_PER_HOUR = 6;

const CONTACT_PREFERENCES = new Set(["email", "phone", "text", "either"]);
const PRIMARY_NEEDS = new Set([
  "New website",
  "Outdated website",
  "Mobile problems",
  "Ownership / platform issues",
  "Not sure yet",
]);

function respond(status: number, body: Record<string, unknown>, origin: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "content-type";
    headers["Access-Control-Max-Age"] = "600";
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function cleanString(value: unknown, max: number, preserveLines = false): string | null {
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (!preserveLines) text = text.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
  else text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text) return null;
  return text.slice(0, max);
}

function validEmail(email: string): boolean {
  return email.length >= 5 && email.length <= 254 &&
    /^[^\s@,;<>()[\]]+@[^\s@,;<>()[\]]+\.[a-z]{2,}$/i.test(email);
}

function validPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

async function addressDigest(req: Request, salt: string): Promise<string> {
  const remoteAddress = (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    "unknown"
  ).trim().slice(0, 100);

  const input = new TextEncoder().encode(
    "black-stag-lead-v1:" + salt + ":" + remoteAddress
  );
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") || "";

  if (!ALLOWED_ORIGINS.has(origin)) {
    return respond(403, { ok: false, message: "This inquiry form is available on the Black Stag Web Design website." }, origin);
  }

  if (req.method === "OPTIONS") {
    return respond(200, { ok: true }, origin);
  }

  if (req.method !== "POST") {
    return respond(405, { ok: false, message: "Method not allowed." }, origin);
  }

  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return respond(415, { ok: false, message: "Unsupported content type." }, origin);
  }

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return respond(413, { ok: false, message: "Request too large." }, origin);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON body");
      body = parsed as Record<string, unknown>;
    } catch {
      return respond(400, { ok: false, message: "Please check the form and try again." }, origin);
    }

    // Honeypot: real visitors never fill this hidden field.
    if (typeof body.website === "string" && body.website.trim().length > 0) {
      return respond(200, { ok: true, message: "Thanks. Your request was received." }, origin);
    }

    const startedAt = typeof body.form_started_at === "number" ? body.form_started_at : 0;
    const elapsedMs = Date.now() - startedAt;
    if (!startedAt || elapsedMs < 1500 || elapsedMs > 86_400_000) {
      return respond(400, { ok: false, message: "Please reload the page and try again." }, origin);
    }

    if (body.consent_to_contact !== true) {
      return respond(400, { ok: false, message: "Please confirm that Black Stag may contact you about this request." }, origin);
    }

    const name = cleanString(body.name, 120);
    const businessName = cleanString(body.business_name, 160);
    const emailRaw = cleanString(body.email, 254);
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    const phone = cleanString(body.phone, 40);
    const websiteUrl = cleanString(body.website_url, 500);
    const contactPreference = cleanString(body.contact_preference, 20) || "either";
    const primaryNeed = cleanString(body.primary_need, 120);
    const message = cleanString(body.message, 3000, true);

    if (!name || !businessName) {
      return respond(400, { ok: false, message: "Please enter your name and business name." }, origin);
    }

    if (!email && !phone) {
      return respond(400, { ok: false, message: "Please enter an email address or phone number." }, origin);
    }

    if (email && !validEmail(email)) {
      return respond(400, { ok: false, message: "Please enter a valid email address." }, origin);
    }

    if (phone && !validPhone(phone)) {
      return respond(400, { ok: false, message: "Please enter a valid phone number." }, origin);
    }

    if (!CONTACT_PREFERENCES.has(contactPreference)) {
      return respond(400, { ok: false, message: "Please choose a contact preference." }, origin);
    }

    if ((contactPreference === "email" && !email) ||
        ((contactPreference === "phone" || contactPreference === "text") && !phone)) {
      return respond(400, { ok: false, message: "Please provide the contact method you selected." }, origin);
    }

    if (primaryNeed && !PRIMARY_NEEDS.has(primaryNeed)) {
      return respond(400, { ok: false, message: "Please choose a website need from the list." }, origin);
    }

    const utmSource = cleanString(body.utm_source, 160);
    const utmMedium = cleanString(body.utm_medium, 160);
    const utmCampaign = cleanString(body.utm_campaign, 200);
    const utmContent = cleanString(body.utm_content, 200);
    const utmTerm = cleanString(body.utm_term, 200);
    const fbclid = cleanString(body.fbclid, 500);
    const landingPath = cleanString(body.landing_path, 300);

    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!baseUrl || !serviceKey) {
      console.error("Black Stag lead intake: missing server configuration");
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    const apiHeaders: Record<string, string> = {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
    };

    const digest = await addressDigest(req, serviceKey);
    const rateResponse = await fetch(baseUrl + "/rest/v1/rpc/black_stag_claim_lead_slot", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ p_ip_digest: digest }),
    });

    if (!rateResponse.ok) {
      console.error("Black Stag lead intake: throttle storage error", rateResponse.status);
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    const allowed = await rateResponse.json();
    if (allowed !== true) {
      return respond(429, {
        ok: false,
        message: "Too many requests from this connection. Please try again in about an hour.",
        limit: MAX_SUBMISSIONS_PER_HOUR,
      }, origin);
    }

    const now = new Date().toISOString();
    const leadRecord = {
      brand_id: BRAND_ID,
      campaign_id: CAMPAIGN_ID,
      name,
      business_name: businessName,
      email,
      phone,
      website_url: websiteUrl,
      contact_preference: contactPreference,
      primary_need: primaryNeed,
      message,
      source: "website_checkup",
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      fbclid,
      landing_path: landingPath,
      status: "new",
      consent_to_contact: true,
      consent_at: now,
      updated_at: now,
    };

    const leadResponse = await fetch(baseUrl + "/rest/v1/black_stag_leads", {
      method: "POST",
      headers: { ...apiHeaders, Prefer: "return=representation" },
      body: JSON.stringify(leadRecord),
    });

    if (!leadResponse.ok) {
      console.error("Black Stag lead intake: lead storage error", leadResponse.status);
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    const leadRows = await leadResponse.json() as Array<{ id?: string }>;
    const leadId = leadRows?.[0]?.id;
    if (!leadId) {
      console.error("Black Stag lead intake: missing lead id after insert");
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    const trackingSummary = [
      utmSource ? "utm_source=" + utmSource : null,
      utmMedium ? "utm_medium=" + utmMedium : null,
      utmCampaign ? "utm_campaign=" + utmCampaign : null,
      utmContent ? "utm_content=" + utmContent : null,
      utmTerm ? "utm_term=" + utmTerm : null,
      fbclid ? "Meta click ID captured" : null,
    ].filter(Boolean).join(" | ");

    const workNotes = [
      "Name: " + name,
      "Business: " + businessName,
      email ? "Email: " + email : null,
      phone ? "Phone: " + phone : null,
      websiteUrl ? "Website/social: " + websiteUrl : null,
      "Preferred contact: " + contactPreference,
      primaryNeed ? "Primary need: " + primaryNeed : null,
      message ? "Message:\n" + message : null,
      "Lead source: Black Stag website checkup landing page",
      landingPath ? "Landing path: " + landingPath : null,
      trackingSummary ? "Tracking: " + trackingSummary : null,
    ].filter(Boolean).join("\n\n");

    const workRecord = {
      brand_id: BRAND_ID,
      title: "New website lead: " + businessName,
      description: "Website checkup request from " + name + " at " + businessName + ".",
      work_type: "follow_up",
      status: "open",
      priority: "high",
      owner_type: "shared",
      related_type: "campaign",
      related_id: CAMPAIGN_ID,
      notes: workNotes,
      updated_at: now,
    };

    const workResponse = await fetch(baseUrl + "/rest/v1/work_items", {
      method: "POST",
      headers: { ...apiHeaders, Prefer: "return=representation" },
      body: JSON.stringify(workRecord),
    });

    if (!workResponse.ok) {
      console.error("Black Stag lead intake: work item storage error", workResponse.status);
      await fetch(baseUrl + "/rest/v1/black_stag_leads?id=eq." + encodeURIComponent(leadId), {
        method: "DELETE",
        headers: apiHeaders,
      });
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    const workRows = await workResponse.json() as Array<{ id?: string }>;
    const workItemId = workRows?.[0]?.id;

    if (!workItemId) {
      console.error("Black Stag lead intake: missing work item id after insert");
      await fetch(baseUrl + "/rest/v1/black_stag_leads?id=eq." + encodeURIComponent(leadId), {
        method: "DELETE",
        headers: apiHeaders,
      });
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    const linkResponse = await fetch(baseUrl + "/rest/v1/black_stag_leads?id=eq." + encodeURIComponent(leadId), {
      method: "PATCH",
      headers: { ...apiHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ work_item_id: workItemId, updated_at: now }),
    });

    if (!linkResponse.ok) {
      console.error("Black Stag lead intake: lead/work item link error", linkResponse.status);
      await fetch(baseUrl + "/rest/v1/work_items?id=eq." + encodeURIComponent(workItemId), {
        method: "DELETE",
        headers: apiHeaders,
      });
      await fetch(baseUrl + "/rest/v1/black_stag_leads?id=eq." + encodeURIComponent(leadId), {
        method: "DELETE",
        headers: apiHeaders,
      });
      return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
    }

    return respond(200, {
      ok: true,
      message: "Thanks. Your website checkup request is in. Black Stag will follow up using your preferred contact method.",
    }, origin);
  } catch (error) {
    console.error("Black Stag lead intake: unexpected error", error instanceof Error ? error.name : "unknown");
    return respond(503, { ok: false, message: "The form is temporarily unavailable. Please try again later." }, origin);
  }
});
