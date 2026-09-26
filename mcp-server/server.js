import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY"
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }
}

const supabaseBase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const supabaseBrowserConfig = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY
};

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

app.set("trust proxy", 1);

/* ========================================
   CORS
   ======================================== */

app.use((req, res, next) => {
  if (req.path === "/mcp") {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "POST, GET, DELETE, OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      [
        "Authorization",
        "Content-Type",
        "Mcp-Session-Id",
        "MCP-Protocol-Version"
      ].join(", ")
    );

    res.setHeader(
      "Access-Control-Expose-Headers",
      "Mcp-Session-Id"
    );

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
  }

  next();
});

app.use(
  express.json({
    limit: "1mb"
  })
);

/* ========================================
   AUTHENTICATION
   ======================================== */

async function authorize(req, res, next) {
  const authHeader =
    req.headers.authorization || "";

  const resourceMetadata =
    `${req.protocol}://${req.get("host")}` +
    "/.well-known/oauth-protected-resource";

  if (
    !authHeader.startsWith("Bearer ")
  ) {
    res.set(
      "WWW-Authenticate",
      `Bearer resource_metadata="${resourceMetadata}"`
    );

    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const accessToken =
    authHeader.slice(7).trim();

  const {
    data: { user },
    error
  } =
    await supabaseBase.auth.getUser(
      accessToken
    );

  if (error || !user) {
    res.set(
      "WWW-Authenticate",
      `Bearer resource_metadata="${resourceMetadata}"`
    );

    return res.status(401).json({
      error:
        "Invalid or expired Supabase user session"
    });
  }

  req.supabaseUser = user;

  req.supabase =
    createUserClient(
      accessToken
    );

  next();
}

/* ========================================
   DATABASE HELPERS
   ======================================== */

async function select(
  table,
  query
) {
  const {
    data,
    error
  } = await query;

  if (error) {
    throw new Error(
      `${table}: ${error.message}`
    );
  }

  return data ?? [];
}

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          value,
          null,
          2
        )
      }
    ]
  };
}

/* ========================================
   READ-ONLY TOOL METADATA
   ======================================== */

const readOnlyToolMetadata = {
  securitySchemes: [
    {
      type: "oauth2",
      scopes: []
    }
  ],

  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

/* ========================================
   MCP SERVER
   ======================================== */

function buildServer(supabase) {
  const server =
    new McpServer({
      name:
        "black-stag-marketing-studio",
      version: "0.1.0"
    });

  /* --------------------------------------
     LIST BRANDS
     -------------------------------------- */

  server.registerTool(
    "list_brands",
    {
      title: "List Brands",

      description:
        "List active Black Stag Marketing Studio brands. Read-only.",

      inputSchema: {},

      ...readOnlyToolMetadata
    },

    async () => {
      const rows =
        await select(
          "brands",

          supabase
            .from("brands")
            .select(
              [
                "id",
                "slug",
                "official_name",
                "short_name",
                "domain",
                "business_type",
                "business_stage",
                "stage_label",
                "tagline",
                "short_description",
                "primary_marketing_goal",
                "active"
              ].join(",")
            )
            .eq(
              "active",
              true
            )
            .order(
              "created_at",
              {
                ascending: true
              }
            )
        );

      return jsonResult(rows);
    }
  );

  /* --------------------------------------
     GET BRAND BRAIN
     -------------------------------------- */

  server.registerTool(
    "get_brand_brain",
    {
      title:
        "Get Brand Brain",

      description:
        "Read the live Brand Brain for one brand, including identity, voice, facts, guardrails, milestones, audiences, and products/services. Read-only.",

      inputSchema: {
        brand_id:
          z.string().uuid()
      },

      ...readOnlyToolMetadata
    },

    async ({ brand_id }) => {
      const brand =
        await select(
          "brands",

          supabase
            .from("brands")
            .select("*")
            .eq(
              "id",
              brand_id
            )
            .single()
        );

      const [
        voice,
        facts,
        rules,
        milestones,
        audiences,
        products
      ] =
        await Promise.all([
          select(
            "brand_voice",

            supabase
              .from(
                "brand_voice"
              )
              .select("*")
              .eq(
                "brand_id",
                brand_id
              )
          ),

          select(
            "brand_facts",

            supabase
              .from(
                "brand_facts"
              )
              .select("*")
              .eq(
                "brand_id",
                brand_id
              )
              .eq(
                "active",
                true
              )
          ),

          select(
            "brand_rules",

            supabase
              .from(
                "brand_rules"
              )
              .select("*")
              .eq(
                "brand_id",
                brand_id
              )
              .eq(
                "active",
                true
              )
          ),

          select(
            "milestones",

            supabase
              .from(
                "milestones"
              )
              .select("*")
              .eq(
                "brand_id",
                brand_id
              )
          ),

          select(
            "brand_audiences",

            supabase
              .from(
                "brand_audiences"
              )
              .select("*")
              .eq(
                "brand_id",
                brand_id
              )
              .eq(
                "active",
                true
              )
          ),

          select(
            "products_services",

            supabase
              .from(
                "products_services"
              )
              .select("*")
              .eq(
                "brand_id",
                brand_id
              )
              .eq(
                "active",
                true
              )
          )
        ]);

      return jsonResult({
        brand,
        voice,
        facts,
        rules,
        milestones,
        audiences,
        products_services:
          products
      });
    }
  );

  /* --------------------------------------
     LIST CAMPAIGNS
     -------------------------------------- */

  server.registerTool(
    "list_campaigns",
    {
      title:
        "List Campaigns",

      description:
        "List campaigns for one brand. Read-only.",

      inputSchema: {
        brand_id:
          z.string().uuid()
      },

      ...readOnlyToolMetadata
    },

    async ({ brand_id }) => {
      const rows =
        await select(
          "campaigns",

          supabase
            .from(
              "campaigns"
            )
            .select("*")
            .eq(
              "brand_id",
              brand_id
            )
            .order(
              "created_at",
              {
                ascending: false
              }
            )
        );

      return jsonResult(rows);
    }
  );

  /* --------------------------------------
     LIST CONTENT
     -------------------------------------- */

  server.registerTool(
    "list_content",
    {
      title:
        "List Content",

      description:
        "List content items for one brand. Read-only.",

      inputSchema: {
        brand_id:
          z.string().uuid()
      },

      ...readOnlyToolMetadata
    },

    async ({ brand_id }) => {
      const rows =
        await select(
          "content_items",

          supabase
            .from(
              "content_items"
            )
            .select("*")
            .eq(
              "brand_id",
              brand_id
            )
            .order(
              "created_at",
              {
                ascending: false
              }
            )
        );

      return jsonResult(rows);
    }
  );

  /* --------------------------------------
     LIST CALENDAR
     -------------------------------------- */

  server.registerTool(
    "list_calendar",
    {
      title:
        "List Calendar",

      description:
        "List calendar items for one brand. Read-only.",

      inputSchema: {
        brand_id:
          z.string().uuid()
      },

      ...readOnlyToolMetadata
    },

    async ({ brand_id }) => {
      const rows =
        await select(
          "calendar_items",

          supabase
            .from(
              "calendar_items"
            )
            .select("*")
            .eq(
              "brand_id",
              brand_id
            )
            .order(
              "starts_at",
              {
                ascending: true
              }
            )
        );

      return jsonResult(rows);
    }
  );

  /* --------------------------------------
     LIST ASSETS
     -------------------------------------- */

  server.registerTool(
    "list_assets",
    {
      title:
        "List Assets",

      description:
        "List Asset Vault metadata for one brand. Does not expose storage credentials or mutate assets. Read-only.",

      inputSchema: {
        brand_id:
          z.string().uuid()
      },

      ...readOnlyToolMetadata
    },

    async ({ brand_id }) => {
      const rows =
        await select(
          "assets",

          supabase
            .from(
              "assets"
            )
            .select(
              [
                "id",
                "brand_id",
                "folder_id",
                "name",
                "asset_type",
                "description",
                "external_url",
                "mime_type",
                "width",
                "height",
                "alt_text",
                "tags",
                "approved_for_ai",
                "approved_for_marketing",
                "active",
                "created_at",
                "updated_at"
              ].join(",")
            )
            .eq(
              "brand_id",
              brand_id
            )
            .eq(
              "active",
              true
            )
            .order(
              "created_at",
              {
                ascending: false
              }
            )
        );

      return jsonResult(rows);
    }
  );

  return server;
}

/* ========================================
   OAUTH CONSENT PAGE
   ======================================== */

app.get(
  "/oauth/consent",
  (req, res) => {
    const authorizationId =
      typeof req.query
        .authorization_id ===
      "string"
        ? req.query
            .authorization_id
        : "";

    const configJson =
      JSON.stringify(
        supabaseBrowserConfig
      ).replace(
        /</g,
        "\\u003c"
      );

    const authorizationIdJson =
      JSON.stringify(
        authorizationId
      ).replace(
        /</g,
        "\\u003c"
      );

    res.type("html").send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <title>
    Authorize Black Stag Marketing Studio
  </title>

  <style>
    :root {
      color-scheme: dark;
      font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;

      background:
        radial-gradient(
          circle at top,
          #243328,
          #0b0d0c 55%
        );

      color: #f3eee5;
    }

    .card {
      width:
        min(100%, 520px);

      padding: 32px;

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          .14
        );

      border-radius: 22px;

      background:
        rgba(
          10,
          12,
          11,
          .92
        );

      box-shadow:
        0 24px 70px
        rgba(
          0,
          0,
          0,
          .4
        );
    }

    h1 {
      margin:
        0 0 10px;

      font-size: 28px;
    }

    p {
      line-height: 1.55;

      color:
        rgba(
          243,
          238,
          229,
          .75
        );
    }

    label {
      display: block;
      margin-top: 18px;
      margin-bottom: 6px;
      font-weight: 600;
    }

    input {
      width: 100%;
      padding: 13px 14px;

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          .16
        );

      border-radius: 10px;
      background: #151816;
      color: #fff;
      font: inherit;
    }

    button {
      width: 100%;
      margin-top: 14px;
      padding: 13px 16px;
      border: 0;
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .primary {
      background: #d8c59d;
      color: #171713;
    }

    .danger {
      background: transparent;

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          .16
        );

      color:
        rgba(
          243,
          238,
          229,
          .8
        );
    }

    .hidden {
      display: none;
    }

    .status {
      margin-top: 18px;
      min-height: 24px;
      color: #e2c98f;
    }

    .details {
      margin: 20px 0;
      padding: 16px;
      border-radius: 12px;

      background:
        rgba(
          255,
          255,
          255,
          .05
        );
    }

    .details strong {
      color: #fff;
    }
  </style>
</head>

<body>
  <main class="card">
    <h1>
      Black Stag Marketing Studio
    </h1>

    <p>
      Sign in to approve ChatGPT's
      read-only access to your Black
      Stag Marketing Studio data.
    </p>

    <section
      id="login"
      class="hidden"
    >
      <label for="email">
        Email
      </label>

      <input
        id="email"
        type="email"
        autocomplete="email"
      />

      <label for="password">
        Password
      </label>

      <input
        id="password"
        type="password"
        autocomplete="current-password"
      />

      <button
        id="sign-in"
        class="primary"
      >
        Sign in
      </button>
    </section>

    <section
      id="consent"
      class="hidden"
    >
      <div class="details">
        <p>
          <strong>
            Application:
          </strong>

          <span id="client-name">
            ChatGPT
          </span>
        </p>

        <p>
          <strong>
            Requested permissions:
          </strong>

          <span id="scopes">
            Account access
          </span>
        </p>
      </div>

      <button
        id="approve"
        class="primary"
      >
        Approve access
      </button>

      <button
        id="deny"
        class="danger"
      >
        Deny
      </button>
    </section>

    <div
      id="status"
      class="status"
    >
      Checking authorization…
    </div>
  </main>

  <script
    src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
  ></script>

  <script>
    const config =
      ${configJson};

    const authorizationId =
      ${authorizationIdJson};

    const client =
      window.supabase.createClient(
        config.url,
        config.anonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

    const loginSection =
      document.getElementById(
        "login"
      );

    const consentSection =
      document.getElementById(
        "consent"
      );

    const status =
      document.getElementById(
        "status"
      );

    const clientName =
      document.getElementById(
        "client-name"
      );

    const scopes =
      document.getElementById(
        "scopes"
      );

    function showStatus(
      message
    ) {
      status.textContent =
        message;
    }

    async function loadAuthorization() {
      if (!authorizationId) {
        showStatus(
          "Missing authorization_id. Start authorization from ChatGPT."
        );

        return;
      }

      const {
        data: {
          user
        }
      } =
        await client.auth
          .getUser();

      if (!user) {
        loginSection
          .classList
          .remove(
            "hidden"
          );

        consentSection
          .classList
          .add(
            "hidden"
          );

        showStatus(
          "Sign in to continue."
        );

        return;
      }

      const {
        data,
        error
      } =
        await client.auth.oauth
          .getAuthorizationDetails(
            authorizationId
          );

      if (error) {
        showStatus(
          error.message
        );

        return;
      }

      if (!data) {
        showStatus(
          "Authorization request could not be loaded."
        );

        return;
      }

      if (
        !(
          "authorization_id"
          in data
        )
      ) {
        if (
          data.redirect_url
        ) {
          window.location.href =
            data.redirect_url;

          return;
        }

        showStatus(
          "Authorization is already complete."
        );

        return;
      }

      if (
        data.client?.name
      ) {
        clientName.textContent =
          data.client.name;
      }

      if (data.scope) {
        scopes.textContent =
          data.scope
            .split(" ")
            .join(", ");
      }

      loginSection
        .classList
        .add(
          "hidden"
        );

      consentSection
        .classList
        .remove(
          "hidden"
        );

      showStatus(
        "Review the request, then approve or deny access."
      );
    }

    document
      .getElementById(
        "sign-in"
      )
      .addEventListener(
        "click",
        async () => {
          const email =
            document
              .getElementById(
                "email"
              )
              .value
              .trim();

          const password =
            document
              .getElementById(
                "password"
              )
              .value;

          showStatus(
            "Signing in…"
          );

          const {
            error
          } =
            await client.auth
              .signInWithPassword({
                email,
                password
              });

          if (error) {
            showStatus(
              error.message
            );

            return;
          }

          await loadAuthorization();
        }
      );

    document
      .getElementById(
        "approve"
      )
      .addEventListener(
        "click",
        async () => {
          showStatus(
            "Approving access…"
          );

          const {
            data,
            error
          } =
            await client.auth.oauth
              .approveAuthorization(
                authorizationId
              );

          if (error) {
            showStatus(
              error.message
            );

            return;
          }

          if (
            !data?.redirect_url
          ) {
            showStatus(
              "Supabase did not return a redirect URL."
            );

            return;
          }

          window.location.href =
            data.redirect_url;
        }
      );

    document
      .getElementById(
        "deny"
      )
      .addEventListener(
        "click",
        async () => {
          showStatus(
            "Denying request…"
          );

          const {
            data,
            error
          } =
            await client.auth.oauth
              .denyAuthorization(
                authorizationId
              );

          if (error) {
            showStatus(
              error.message
            );

            return;
          }

          if (
            data?.redirect_url
          ) {
            window.location.href =
              data.redirect_url;

            return;
          }

          showStatus(
            "Authorization denied."
          );
        }
      );

    loadAuthorization()
      .catch(
        (error) => {
          console.error(
            error
          );

          showStatus(
            error?.message ||
              "Authorization failed."
          );
        }
      );
  </script>
</body>
</html>
    `);
  }
);

/* ========================================
   HEALTH
   ======================================== */

app.get(
  "/health",
  (_req, res) => {
    res.json({
      ok: true,
      mode: "read-only"
    });
  }
);

/* ========================================
   OAUTH PROTECTED RESOURCE METADATA
   ======================================== */

app.get(
  "/.well-known/oauth-protected-resource",
  (req, res) => {
    res.json({
      resource:
        `${req.protocol}://${req.get("host")}/mcp`,

      authorization_servers: [
        `${process.env.SUPABASE_URL}/auth/v1`
      ],

      bearer_methods_supported: [
        "header"
      ]
    });
  }
);

/* ========================================
   MCP TRANSPORT
   ======================================== */

async function handleMcpRequest(
  req,
  res
) {
  const server =
    buildServer(
      req.supabase
    );

  const transport =
    new StreamableHTTPServerTransport({
      sessionIdGenerator:
        undefined,

      enableJsonResponse:
        true
    });

  res.on(
    "close",
    () => {
      transport
        .close()
        .catch(
          () => {}
        );

      server
        .close()
        .catch(
          () => {}
        );
    }
  );

  try {
    await server.connect(
      transport
    );

    await transport.handleRequest(
      req,
      res,
      req.body
    );
  } catch (error) {
    console.error(
      "Error handling MCP request:",
      error
    );

    if (!res.headersSent) {
      res
        .status(500)
        .json({
          error:
            "Internal MCP server error"
        });
    }
  }
}

app.post(
  "/mcp",
  authorize,
  handleMcpRequest
);

app.get(
  "/mcp",
  authorize,
  handleMcpRequest
);

app.delete(
  "/mcp",
  authorize,
  handleMcpRequest
);
/* ========================================
   FALLBACK
   ======================================== */

app.use(
  (_req, res) => {
    res
      .status(404)
      .json({
        error: "Not found"
      });
  }
);

/* ========================================
   START SERVER
   ======================================== */

const port =
  Number(
    process.env.PORT ||
      3000
  );

app.listen(
  port,
  () => {
    console.log(
      `Black Stag MCP listening on port ${port} (read-only)`
    );
  }
);