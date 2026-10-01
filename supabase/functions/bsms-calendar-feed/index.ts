import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import postgres from "npm:postgres@3.4.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const dbUrl = Deno.env.get("SUPABASE_DB_URL") || "";

if (!supabaseUrl) throw new Error("SUPABASE_URL is unavailable.");
if (!dbUrl) throw new Error("SUPABASE_DB_URL is unavailable.");

const sql = postgres(dbUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getProjectPublicKey() {
  const direct =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY");

  if (direct) return direct;

  const keysJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!keysJson) return "";

  try {
    const keys = JSON.parse(keysJson);
    return keys.default || Object.values(keys)[0] || "";
  } catch {
    return "";
  }
}

function validTimeZone(value: unknown) {
  const candidate = typeof value === "string" && value.trim()
    ? value.trim()
    : "America/New_York";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "America/New_York";
  }
}

async function authenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const publicKey = getProjectPublicKey();
  if (!publicKey) throw new Error("Supabase public key is unavailable.");

  const token = authHeader.slice("Bearer ".length).trim();
  const client = createClient(supabaseUrl, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

function icsEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function utcStamp(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function localDateStamp(value: unknown, timeZone: string) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );

  return `${map.year}${map.month}${map.day}`;
}

function normalizeRRule(value: unknown) {
  const rule = String(value || "").trim().replace(/[\r\n]+/g, "");
  if (!rule) return "";
  return rule.toUpperCase().startsWith("RRULE:")
    ? rule
    : `RRULE:${rule}`;
}

function buildEvent(item: any, timeZone: string) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:bsms-${item.source_kind}-${item.id}@blackstagmarketingstudio`,
    `DTSTAMP:${utcStamp(item.updated_at || new Date().toISOString())}`,
  ];

  if (item.all_day) {
    const startDate = localDateStamp(item.starts_at, timeZone);
    if (startDate) lines.push(`DTSTART;VALUE=DATE:${startDate}`);

    if (item.ends_at) {
      const endDate = localDateStamp(item.ends_at, timeZone);
      if (endDate) lines.push(`DTEND;VALUE=DATE:${endDate}`);
    }
  } else {
    const start = utcStamp(item.starts_at);
    if (start) lines.push(`DTSTART:${start}`);

    const end = utcStamp(item.ends_at);
    if (end) lines.push(`DTEND:${end}`);
  }

  const brandName = item.brand_name || "Black Stag";
  const summary = item.title
    ? `${brandName} — ${item.title}`
    : brandName;

  lines.push(`SUMMARY:${icsEscape(summary)}`);

  const descriptionParts = [
    item.description,
    `Brand: ${brandName}`,
  ].filter(Boolean);

  if (descriptionParts.length) {
    lines.push(`DESCRIPTION:${icsEscape(descriptionParts.join("\n\n"))}`);
  }

  if (item.item_type) {
    lines.push(`CATEGORIES:${icsEscape(item.item_type)}`);
  }

  const rrule = normalizeRRule(item.recurrence_rule);
  if (item.recurring && rrule) lines.push(rrule);

  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

async function buildCalendarFeed(feedToken: string) {
  const tokenRows = await sql`
    select owner_id, timezone
    from private.calendar_feed_subscriptions
    where feed_token = ${feedToken}::uuid
    limit 1
  `;

  if (!tokenRows.length) return null;

  const ownerId = tokenRows[0].owner_id;
  const timeZone = validTimeZone(tokenRows[0].timezone);

  await sql`
    update private.calendar_feed_subscriptions
    set last_accessed_at = now(), updated_at = now()
    where feed_token = ${feedToken}::uuid
  `;

  const items = await sql`
    with accessible_brands as (
      select distinct
        b.id,
        coalesce(b.short_name, b.official_name) as brand_name
      from public.brands b
      left join public.brand_memberships bm
        on bm.brand_id = b.id
       and bm.user_id = ${ownerId}::uuid
      where b.active = true
        and (
          b.owner_id = ${ownerId}::uuid
          or bm.user_id = ${ownerId}::uuid
        )
    )
    select *
    from (
      select
        'calendar'::text as source_kind,
        ci.id,
        ci.title,
        ci.description,
        ci.item_type,
        ci.starts_at,
        ci.ends_at,
        ci.all_day,
        ci.recurring,
        ci.recurrence_rule,
        ci.updated_at,
        ab.brand_name
      from public.calendar_items ci
      join accessible_brands ab on ab.id = ci.brand_id
      where ci.confirmed = true
        and ci.starts_at is not null

      union all

      select
        'content'::text as source_kind,
        c.id,
        coalesce(c.title, 'Scheduled Content') as title,
        nullif(
          concat_ws(
            ' · ',
            nullif(c.platform, ''),
            nullif(c.goal, '')
          ),
          ''
        ) as description,
        'scheduled content'::text as item_type,
        c.scheduled_for as starts_at,
        null::timestamptz as ends_at,
        false as all_day,
        false as recurring,
        null::text as recurrence_rule,
        c.updated_at,
        ab.brand_name
      from public.content_items c
      join accessible_brands ab on ab.id = c.brand_id
      where c.status = 'scheduled'
        and c.scheduled_for is not null
    ) feed_items
    order by starts_at, brand_name, title
  `;

  const calendarLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Black Stag Marketing Studio//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Black Stag Marketing Studio",
    `X-WR-TIMEZONE:${timeZone}`,
    ...items.map(item => buildEvent(item, timeZone)),
    "END:VCALENDAR",
    "",
  ];

  return calendarLines.join("\r\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const token = url.searchParams.get("token") || "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
        return new Response("Calendar feed not found.", { status: 404 });
      }

      const feed = await buildCalendarFeed(token);
      if (!feed) {
        return new Response("Calendar feed not found.", { status: 404 });
      }

      return new Response(feed, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'inline; filename="black-stag-marketing-studio.ics"',
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "GET or POST required." }, 405);
    }

    const user = await authenticatedUser(req);
    if (!user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "subscribe");
    const timeZone = validTimeZone(body?.timezone);

    if (!["subscribe", "rotate"].includes(action)) {
      return jsonResponse({ error: "Unknown action." }, 400);
    }

    let rows;

    if (action === "rotate") {
      rows = await sql`
        insert into private.calendar_feed_subscriptions (
          owner_id,
          feed_token,
          timezone,
          created_at,
          updated_at
        )
        values (
          ${user.id}::uuid,
          gen_random_uuid(),
          ${timeZone},
          now(),
          now()
        )
        on conflict (owner_id)
        do update set
          feed_token = gen_random_uuid(),
          timezone = excluded.timezone,
          updated_at = now()
        returning feed_token
      `;
    } else {
      rows = await sql`
        insert into private.calendar_feed_subscriptions (
          owner_id,
          timezone,
          created_at,
          updated_at
        )
        values (
          ${user.id}::uuid,
          ${timeZone},
          now(),
          now()
        )
        on conflict (owner_id)
        do update set
          timezone = excluded.timezone,
          updated_at = now()
        returning feed_token
      `;
    }

    const feedToken = rows[0].feed_token;
    const feedUrl = `${supabaseUrl}/functions/v1/bsms-calendar-feed?token=${feedToken}`;
    const webcalUrl = feedUrl.replace(/^https:/i, "webcal:");

    return jsonResponse({
      ok: true,
      feed_url: feedUrl,
      webcal_url: webcalUrl,
      timezone: timeZone,
    });
  } catch (error) {
    console.error("bsms-calendar-feed failed:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown calendar feed error.",
    }, 500);
  }
});
