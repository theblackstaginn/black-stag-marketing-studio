import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "MCP_BEARER_TOKEN"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const supabaseBase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function createUserClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
}

const app = express();
app.use(express.json({ limit: "1mb" }));

function safeEqual(a = "", b = "") {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

async function authorize(req, res, next) {
  const bridgeHeader = req.get("x-black-stag-token") || "";
  if (!safeEqual(bridgeHeader, process.env.MCP_BEARER_TOKEN)) {
    return res.status(401).json({ error: "Unauthorized bridge client" });
  }

  const authHeader = req.get("authorization") || "";
  const accessToken =
    authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

  if (!accessToken) {
    return res.status(401).json({ error: "Missing Supabase user access token" });
  }

  const {
    data: { user },
    error
  } = await supabaseBase.auth.getUser(accessToken);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired Supabase user session" });
  }

  req.supabaseUser = user;
  req.supabase = createUserClient(accessToken);
  next();
}

async function select(table, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

function jsonResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function buildServer(supabase) {
  const server = new McpServer({
    name: "black-stag-marketing-studio",
    version: "0.1.0"
  });

  server.tool(
    "list_brands",
    "List active Black Stag Marketing Studio brands. Read-only.",
    {},
    async () => {
      const rows = await select("brands",
        supabase.from("brands")
          .select("id,slug,official_name,short_name,domain,business_type,business_stage,stage_label,tagline,short_description,primary_marketing_goal,active")
          .eq("active", true)
          .order("created_at", { ascending: true })
      );
      return jsonResult(rows);
    }
  );

  server.tool(
    "get_brand_brain",
    "Read the live Brand Brain for one brand, including identity, voice, facts, guardrails, milestones, audiences, and products/services. Read-only.",
    { brand_id: z.string().uuid() },
    async ({ brand_id }) => {
      const brand = await select("brands",
        supabase.from("brands")
          .select("*")
          .eq("id", brand_id)
          .single()
      );
      const [voice, facts, rules, milestones, audiences, products] = await Promise.all([
        select("brand_voice", supabase.from("brand_voice").select("*").eq("brand_id", brand_id)),
        select("brand_facts", supabase.from("brand_facts").select("*").eq("brand_id", brand_id).eq("active", true)),
        select("brand_rules", supabase.from("brand_rules").select("*").eq("brand_id", brand_id).eq("active", true)),
        select("milestones", supabase.from("milestones").select("*").eq("brand_id", brand_id)),
        select("brand_audiences", supabase.from("brand_audiences").select("*").eq("brand_id", brand_id).eq("active", true)),
        select("products_services", supabase.from("products_services").select("*").eq("brand_id", brand_id).eq("active", true))
      ]);
      return jsonResult({ brand, voice, facts, rules, milestones, audiences, products_services: products });
    }
  );

  server.tool(
    "list_campaigns",
    "List campaigns for one brand. Read-only.",
    { brand_id: z.string().uuid() },
    async ({ brand_id }) => jsonResult(await select("campaigns",
      supabase.from("campaigns").select("*").eq("brand_id", brand_id).order("created_at", { ascending: false })
    ))
  );

  server.tool(
    "list_content",
    "List content items for one brand. Read-only.",
    { brand_id: z.string().uuid() },
    async ({ brand_id }) => jsonResult(await select("content_items",
      supabase.from("content_items").select("*").eq("brand_id", brand_id).order("created_at", { ascending: false })
    ))
  );

  server.tool(
    "list_calendar",
    "List calendar items for one brand. Read-only.",
    { brand_id: z.string().uuid() },
    async ({ brand_id }) => jsonResult(await select("calendar_items",
      supabase.from("calendar_items").select("*").eq("brand_id", brand_id).order("starts_at", { ascending: true })
    ))
  );

  server.tool(
    "list_assets",
    "List Asset Vault metadata for one brand. Does not expose storage credentials or mutate assets. Read-only.",
    { brand_id: z.string().uuid() },
    async ({ brand_id }) => jsonResult(await select("assets",
      supabase.from("assets")
        .select("id,brand_id,folder_id,name,asset_type,description,external_url,mime_type,width,height,alt_text,tags,approved_for_ai,approved_for_marketing,active,created_at,updated_at")
        .eq("brand_id", brand_id)
        .eq("active", true)
        .order("created_at", { ascending: false })
    ))
  );

  return server;
}

app.get("/health", (_req, res) => res.json({ ok: true, mode: "read-only" }));

app.post("/mcp", authorize, async (req, res) => {
  const server = buildServer(req.supabase);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.all("/mcp", authorize, (_req, res) => {
  res.status(405).json({ error: "Only POST is enabled for this stateless read-only bridge." });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Black Stag MCP listening on port ${port} (read-only)`);
});
