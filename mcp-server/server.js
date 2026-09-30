import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
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
  const corsEnabledPaths =
    new Set([
      "/mcp",
      "/.well-known/oauth-protected-resource"
    ]);

  if (corsEnabledPaths.has(req.path)) {
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
      [
        "Mcp-Session-Id",
        "WWW-Authenticate"
      ].join(", ")
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


const OpenAIFileSchema =
  z.object({
    download_url:
      z.string().url(),

    file_id:
      z.string().min(1),

    mime_type:
      z.string().optional(),

    file_name:
      z.string().optional()
  })
  .strict();


function safeFileBase(value) {
  return String(
    value ||
    "generated-image"
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9._-]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(
      0,
      80
    ) ||
    "generated-image";
}


function extensionForMime(mimeType) {
  const normalized =
    String(
      mimeType ||
      ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  if (
    normalized ===
    "image/jpeg"
  ) {
    return "jpg";
  }

  if (
    normalized ===
    "image/webp"
  ) {
    return "webp";
  }

  if (
    normalized ===
    "image/gif"
  ) {
    return "gif";
  }

  return "png";
}


function isSupportedImageMime(mimeType) {
  return new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
  ]).has(
    String(
      mimeType ||
      ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase()
  );
}


function isAllowedExternalAssetHost(hostname) {
  return new Set([
    "raw.githubusercontent.com",
    "github.com",
    "user-images.githubusercontent.com"
  ]).has(
    String(
      hostname ||
      ""
    )
      .trim()
      .toLowerCase()
  );
}


const STUDIO_UI_URI =
  "ui://black-stag/marketing-studio.html";

const STUDIO_UI_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  />
  <title>Black Stag Marketing Studio</title>
  <style>
    :root {
      color-scheme: dark;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      --ink: #f1e7d2;
      --muted: #b7aa95;
      --panel: rgba(17, 15, 14, 0.78);
      --panel-soft: rgba(31, 25, 21, 0.68);
      --line: rgba(197, 134, 76, 0.38);
      --copper: #c5864c;
      --copper-soft: #e2b17b;
      --shadow: rgba(0, 0, 0, 0.42);
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      background:
        radial-gradient(
          circle at 18% 12%,
          rgba(132, 77, 42, 0.16),
          transparent 34%
        ),
        radial-gradient(
          circle at 86% 4%,
          rgba(103, 53, 31, 0.14),
          transparent 31%
        ),
        linear-gradient(
          180deg,
          #151210 0%,
          #0d0b0a 100%
        );
      color: var(--ink);
    }

    body {
      padding:
        max(18px, env(safe-area-inset-top))
        max(18px, env(safe-area-inset-right))
        max(88px, calc(env(safe-area-inset-bottom) + 72px))
        max(18px, env(safe-area-inset-left));
    }

    .shell {
      width: min(1180px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }

    .masthead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background:
        linear-gradient(
          180deg,
          rgba(44, 34, 28, 0.82),
          rgba(19, 16, 14, 0.9)
        );
      box-shadow:
        0 20px 50px var(--shadow),
        inset 0 1px rgba(255, 255, 255, 0.04);
    }

    .brand {
      min-width: 0;
    }

    .eyebrow {
      margin: 0 0 5px;
      color: var(--copper-soft);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-family:
        Georgia,
        "Times New Roman",
        serif;
      font-size: clamp(1.45rem, 4vw, 2.4rem);
      font-weight: 700;
      line-height: 1.05;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      padding: 8px 12px;
      border: 1px solid rgba(197, 134, 76, 0.28);
      border-radius: 999px;
      color: var(--muted);
      background: rgba(0, 0, 0, 0.18);
      font-size: 0.83rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--copper);
      box-shadow: 0 0 14px rgba(197, 134, 76, 0.7);
    }

    .grid {
      display: grid;
      grid-template-columns:
        minmax(0, 1.6fr)
        minmax(260px, 0.8fr);
      gap: 18px;
    }

    .panel {
      min-width: 0;
      border: 1px solid rgba(197, 134, 76, 0.24);
      border-radius: 20px;
      padding: 20px;
      background: var(--panel);
      box-shadow:
        0 18px 44px rgba(0, 0, 0, 0.28),
        inset 0 1px rgba(255, 255, 255, 0.035);
      backdrop-filter: blur(12px);
    }

    .panel h2 {
      margin: 0 0 8px;
      font-family:
        Georgia,
        "Times New Roman",
        serif;
      font-size: 1.25rem;
    }

    .panel p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .ask-form {
      margin-top: 18px;
      display: grid;
      gap: 12px;
    }

    textarea {
      width: 100%;
      min-height: 132px;
      resize: vertical;
      border: 1px solid rgba(197, 134, 76, 0.34);
      border-radius: 16px;
      padding: 14px 15px;
      color: var(--ink);
      background: rgba(4, 4, 4, 0.32);
      font: inherit;
      line-height: 1.45;
      outline: none;
    }

    textarea:focus {
      border-color: rgba(226, 177, 123, 0.7);
      box-shadow: 0 0 0 3px rgba(197, 134, 76, 0.12);
    }

    button {
      appearance: none;
      border: 1px solid rgba(226, 177, 123, 0.5);
      border-radius: 14px;
      padding: 11px 14px;
      color: #17100b;
      background:
        linear-gradient(
          180deg,
          #dfad78,
          #a96232
        );
      font: inherit;
      font-weight: 850;
      cursor: pointer;
      box-shadow:
        inset 0 1px rgba(255, 255, 255, 0.28),
        0 10px 24px rgba(0, 0, 0, 0.25);
    }

    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }

    .quick-actions {
      display: grid;
      gap: 10px;
      margin-top: 16px;
    }

    .quick-actions button {
      width: 100%;
      text-align: left;
      color: var(--ink);
      background:
        linear-gradient(
          180deg,
          rgba(67, 50, 40, 0.88),
          rgba(35, 27, 23, 0.9)
        );
    }

    .helper {
      margin-top: 12px !important;
      font-size: 0.86rem;
    }

    .bridge-status {
      margin-top: 12px;
      min-height: 1.3em;
      color: var(--copper-soft);
      font-size: 0.86rem;
    }

    .rule {
      height: 1px;
      margin: 18px 0;
      background:
        linear-gradient(
          90deg,
          transparent,
          rgba(197, 134, 76, 0.42),
          transparent
        );
    }

    .small {
      font-size: 0.88rem;
    }


    body[data-mode="pip"] {
      padding: 10px;
    }

    body[data-mode="pip"] .shell {
      width: 100%;
      gap: 10px;
    }

    body[data-mode="pip"] .masthead {
      padding: 12px 14px;
      border-radius: 16px;
    }

    body[data-mode="pip"] .grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    body[data-mode="pip"] .panel {
      padding: 14px;
      border-radius: 16px;
    }

    body[data-mode="pip"] .panel > p:not(.eyebrow):not(.bridge-status),
    body[data-mode="pip"] .helper,
    body[data-mode="pip"] aside.panel {
      display: none;
    }

    body[data-mode="pip"] textarea {
      min-height: 72px;
      resize: none;
    }

    body[data-mode="pip"] .ask-form {
      margin-top: 10px;
      gap: 8px;
    }

    .mode-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .mode-actions button {
      padding: 8px 11px;
      font-size: 0.82rem;
      color: var(--ink);
      background:
        linear-gradient(
          180deg,
          rgba(67, 50, 40, 0.88),
          rgba(35, 27, 23, 0.9)
        );
    }

    #expandButton {
      display: none;
    }

    body[data-mode="pip"] #pinButton {
      display: none;
    }

    body[data-mode="pip"] #expandButton {
      display: inline-flex;
    }

    @media (max-width: 760px) {
      body {
        padding-left: 12px;
        padding-right: 12px;
      }

      .masthead {
        align-items: flex-start;
        flex-direction: column;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      .status {
        white-space: normal;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="masthead">
      <div class="brand">
        <p class="eyebrow">Black Stag</p>
        <h1>Marketing Studio</h1>
      </div>

      <div class="mode-actions">
        <button id="pinButton" type="button">
          Pin Ember
        </button>

        <button id="expandButton" type="button">
          Expand Studio
        </button>

        <div class="status">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="connectionLabel">Connecting Ember...</span>
        </div>
      </div>
    </header>

    <section class="grid">
      <article class="panel">
        <p class="eyebrow">Ask Ember</p>
        <h2>Use the same ChatGPT conversation from inside Studio.</h2>
        <p>
          Messages sent here become normal user messages in this ChatGPT
          conversation. Ember can then use the existing Marketing Studio tools,
          Asset Vault, Brand Brain, work queues, and other connected tools.
        </p>

        <form class="ask-form" id="askForm">
          <textarea
            id="askInput"
            maxlength="12000"
            placeholder="Ask Ember what you want to work on..."
          ></textarea>

          <button id="askButton" type="submit">
            Send to Ember
          </button>
        </form>

        <p class="bridge-status" id="bridgeStatus" aria-live="polite"></p>

        <div class="rule"></div>

        <p class="helper">
          The native ChatGPT composer remains available in fullscreen too, so
          you can use either input.
        </p>
      </article>

      <aside class="panel">
        <p class="eyebrow">Quick actions</p>
        <h2>Start with context.</h2>
        <p class="small">
          These buttons send a normal follow-up message to Ember. They do not
          publish, schedule, approve, or delete anything.
        </p>

        <div class="quick-actions">
          <button
            type="button"
            data-prompt="Morning Ember. Build my live Black Stag Marketing Studio daily brief and tell me what needs attention first."
          >
            Morning Ember
          </button>

          <button
            type="button"
            data-prompt="Show me the open work items across my Black Stag Marketing Studio brands and help me choose what to tackle next."
          >
            Open work
          </button>

          <button
            type="button"
            data-prompt="Open my Marketing Studio Asset Vault workflow. Tell me what asset work is currently waiting or incomplete."
          >
            Asset work
          </button>
        </div>
      </aside>
    </section>
  </main>

  <script>
    const connectionLabel =
      document.getElementById("connectionLabel");

    const bridgeStatus =
      document.getElementById("bridgeStatus");

    const askForm =
      document.getElementById("askForm");

    const askInput =
      document.getElementById("askInput");

    const askButton =
      document.getElementById("askButton");

    const pinButton =
      document.getElementById("pinButton");

    const expandButton =
      document.getElementById("expandButton");

    const pendingRequests =
      new Map();

    let nextRequestId = 1;
    let bridgeReady = false;

    function rpcRequest(method, params) {
      const id = nextRequestId++;

      window.parent.postMessage(
        {
          jsonrpc: "2.0",
          id,
          method,
          params
        },
        "*"
      );

      return new Promise(
        (resolve, reject) => {
          pendingRequests.set(
            id,
            {
              resolve,
              reject
            }
          );
        }
      );
    }

    function rpcNotify(method, params) {
      window.parent.postMessage(
        {
          jsonrpc: "2.0",
          method,
          params
        },
        "*"
      );
    }

    window.addEventListener(
      "message",
      (event) => {
        if (
          event.source !==
          window.parent
        ) {
          return;
        }

        const message =
          event.data;

        if (
          !message ||
          message.jsonrpc !==
            "2.0"
        ) {
          return;
        }

        if (
          typeof message.id ===
          "number"
        ) {
          const pending =
            pendingRequests.get(
              message.id
            );

          if (!pending) {
            return;
          }

          pendingRequests.delete(
            message.id
          );

          if (message.error) {
            pending.reject(
              message.error
            );

            return;
          }

          pending.resolve(
            message.result
          );
        }
      },
      {
        passive: true
      }
    );


    function applyDisplayMode(mode) {
      const normalized =
        mode === "pip"
          ? "pip"
          : "fullscreen";

      document.body.dataset.mode =
        normalized;
    }

    async function requestMode(mode) {
      if (
        !window.openai ||
        !window.openai.requestDisplayMode
      ) {
        return false;
      }

      try {
        await window.openai.requestDisplayMode({
          mode
        });

        applyDisplayMode(mode);

        return true;
      } catch (error) {
        console.warn(
          "Display mode request failed.",
          error
        );

        return false;
      }
    }

    applyDisplayMode(
      window.openai?.displayMode ||
      "fullscreen"
    );

    window.addEventListener(
      "openai:set_globals",
      (event) => {
        const mode =
          event?.detail?.globals
            ?.displayMode;

        if (mode) {
          applyDisplayMode(mode);
        }
      },
      {
        passive: true
      }
    );

    pinButton?.addEventListener(
      "click",
      async () => {
        await requestMode("pip");
      }
    );

    expandButton?.addEventListener(
      "click",
      async () => {
        await requestMode(
          "fullscreen"
        );
      }
    );

    async function initializeBridge() {
      try {
        await rpcRequest(
          "ui/initialize",
          {
            appInfo: {
              name:
                "black-stag-marketing-studio",
              version:
                "0.1.0"
            },
            appCapabilities: {
              availableDisplayModes: [
                "fullscreen",
                "pip"
              ]
            },
            protocolVersion:
              "2026-01-26"
          }
        );

        rpcNotify(
          "ui/notifications/initialized",
          {}
        );

        bridgeReady = true;
        connectionLabel.textContent =
          "Ember bridge ready";

        bridgeStatus.textContent =
          "Connected to the current ChatGPT conversation.";

        await requestMode(
          "fullscreen"
        );
      } catch (error) {
        connectionLabel.textContent =
          "ChatGPT bridge available";

        bridgeStatus.textContent =
          "Using ChatGPT compatibility bridge.";

        console.warn(
          "MCP Apps bridge initialization failed.",
          error
        );
      }
    }

    const ready =
      initializeBridge();

    async function sendPrompt(prompt) {
      const text =
        String(
          prompt ||
          ""
        ).trim();

      if (!text) {
        return;
      }

      askButton.disabled = true;
      bridgeStatus.textContent =
        "Sending to Ember...";

      try {
        await ready;

        if (bridgeReady) {
          const result =
            await rpcRequest(
              "ui/message",
              {
                role: "user",
                content: [
                  {
                    type:
                      "text",
                    text
                  }
                ]
              }
            );

          if (
            result &&
            result.isError
          ) {
            throw new Error(
              "ChatGPT rejected the message."
            );
          }
        } else if (
          window.openai &&
          window.openai
            .sendFollowUpMessage
        ) {
          await window.openai
            .sendFollowUpMessage({
              prompt: text,
              scrollToBottom:
                false
            });
        } else {
          throw new Error(
            "No ChatGPT message bridge is available."
          );
        }

        askInput.value = "";
        bridgeStatus.textContent =
          "Sent. Ember is responding in this conversation.";
      } catch (error) {
        console.error(
          "Unable to send Studio message.",
          error
        );

        bridgeStatus.textContent =
          "Could not send the message. Use the native ChatGPT composer below and retry.";
      } finally {
        askButton.disabled =
          false;
      }
    }

    askForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await sendPrompt(
          askInput.value
        );
      }
    );

    document
      .querySelectorAll(
        "[data-prompt]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            async () => {
              await sendPrompt(
                button.dataset
                  .prompt
              );
            }
          );
        }
      );
  </script>
</body>
</html>`;

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

const writeToolMetadata = {
  securitySchemes: [
    {
      type: "oauth2",
      scopes: []
    }
  ],

  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
};

/* ========================================
   MCP SERVER
   ======================================== */

function buildServer(supabase, authenticatedUser) {
  const server =
    new McpServer({
      name:
        "black-stag-marketing-studio",
      version: "0.1.0"
    });

  /* --------------------------------------
     MARKETING STUDIO UI
     -------------------------------------- */

  registerAppResource(
    server,
    "black-stag-marketing-studio-ui",
    STUDIO_UI_URI,
    {
      title:
        "Black Stag Marketing Studio",
      description:
        "Black Stag Marketing Studio interface for use inside ChatGPT, with fullscreen and persistent picture-in-picture modes.",
      _meta: {
        ui: {
          prefersBorder:
            false
        }
      }
    },
    async (uri) => ({
      contents: [
        {
          uri:
            uri.href,
          mimeType:
            RESOURCE_MIME_TYPE,
          text:
            STUDIO_UI_HTML,
          _meta: {
            ui: {
              prefersBorder:
                false
            },
            "openai/ui": {
              availableDisplayModes: [
                "fullscreen",
                "pip"
              ]
            }
          }
        }
      ]
    })
  );

  registerAppTool(
    server,
    "open_marketing_studio",
    {
      title:
        "Open Marketing Studio",

      description:
        "Open the Black Stag Marketing Studio as a fullscreen interface inside ChatGPT. Use when the owner asks to open, enter, view, or work inside Marketing Studio.",

      inputSchema: {},

      _meta: {
        ui: {
          resourceUri:
            STUDIO_UI_URI,
          visibility: [
            "model",
            "app"
          ]
        },

        "openai/outputTemplate":
          STUDIO_UI_URI
      },

      ...readOnlyToolMetadata
    },

    async () => ({
      content: [
        {
          type:
            "text",

          text:
            "Black Stag Marketing Studio is ready."
        }
      ],

      structuredContent: {
        ready:
          true
      }
    })
  );

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
     CREATE CONTENT
     -------------------------------------- */

  server.registerTool(
    "create_content",
    {
      title:
        "Create Content Draft",

      description:
        "Create a new draft content item for one brand in Black Stag Marketing Studio. This writes a new row but does not publish or schedule anything.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        content_type:
          z.enum([
            "social_post",
            "story",
            "reel_script",
            "email",
            "website_copy",
            "promotional_graphic",
            "campaign",
            "other"
          ]),

        title:
          z.string().trim().min(1).optional(),

        body:
          z.string().trim().min(1),

        platform:
          z.string().trim().min(1).optional(),

        goal:
          z.string().trim().min(1).optional(),

        original_request:
          z.string().trim().min(1).optional(),

        ai_brief:
          z.string().trim().min(1).optional(),

        campaign_id:
          z.string().uuid().optional()
      },

      ...writeToolMetadata
    },

    async ({
      brand_id,
      content_type,
      title,
      body,
      platform,
      goal,
      original_request,
      ai_brief,
      campaign_id
    }) => {
      const payload = {
        brand_id,
        content_type,
        status:
          "draft",
        title:
          title || null,
        body,
        platform:
          platform || null,
        goal:
          goal || null,
        original_request:
          original_request || null,
        ai_mode:
          "chatgpt-mcp",
        ai_brief:
          ai_brief || null,
        campaign_id:
          campaign_id || null
      };

      const {
        data,
        error
      } =
        await supabase
          .from(
            "content_items"
          )
          .insert(
            payload
          )
          .select()
          .single();

      if (error) {
        throw new Error(
          `content_items: ${error.message}`
        );
      }

      return jsonResult(data);
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
                "storage_bucket",
                "storage_path",
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


  /* --------------------------------------
     GET ASSET IMAGE
     -------------------------------------- */

  server.registerTool(
    "get_asset_image",
    {
      title:
        "Get Asset Image",

      description:
        "Load one image from the private Asset Vault so ChatGPT can visually inspect it. Read-only. Use after list_assets when an actual visual reference is needed.",

      inputSchema: {
        asset_id:
          z.string().uuid()
      },

      ...readOnlyToolMetadata
    },

    async ({ asset_id }) => {
      const asset =
        await select(
          "assets",

          supabase
            .from("assets")
            .select(
              [
                "id",
                "brand_id",
                "name",
                "asset_type",
                "description",
                "storage_bucket",
                "storage_path",
                "external_url",
                "mime_type",
                "alt_text",
                "tags",
                "approved_for_ai",
                "approved_for_marketing",
                "active"
              ].join(",")
            )
            .eq(
              "id",
              asset_id
            )
            .eq(
              "active",
              true
            )
            .single()
        );

      const mimeType =
        String(
          asset?.mime_type ||
          ""
        )
          .split(";")[0]
          .trim()
          .toLowerCase();

      if (
        mimeType &&
        !isSupportedImageMime(
          mimeType
        )
      ) {
        throw new Error(
          "This Asset Vault item is not a supported raster image."
        );
      }

      let bytes;
      let resolvedMime =
        mimeType;

      if (
        asset?.storage_bucket &&
        asset?.storage_path
      ) {
        const {
          data,
          error
        } =
          await supabase.storage
            .from(
              asset.storage_bucket
            )
            .download(
              asset.storage_path
            );

        if (error) {
          throw new Error(
            "Asset image download failed: " +
            error.message
          );
        }

        bytes =
          Buffer.from(
            await data.arrayBuffer()
          );

        resolvedMime =
          resolvedMime ||
          data.type ||
          "image/png";

      } else if (
        asset?.external_url
      ) {
        const url =
          new URL(
            asset.external_url
          );

        if (
          url.protocol !==
          "https:" ||
          !isAllowedExternalAssetHost(
            url.hostname
          )
        ) {
          throw new Error(
            "This external Asset Vault image source is not on an approved host."
          );
        }

        const response =
          await fetch(
            url,
            {
              redirect:
                "follow"
            }
          );

        if (!response.ok) {
          throw new Error(
            "External Asset Vault image could not be loaded."
          );
        }

        bytes =
          Buffer.from(
            await response.arrayBuffer()
          );

        resolvedMime =
          resolvedMime ||
          response.headers.get(
            "content-type"
          ) ||
          "image/png";

      } else {
        throw new Error(
          "This Asset Vault item has no readable image source."
        );
      }

      resolvedMime =
        String(
          resolvedMime ||
          "image/png"
        )
          .split(";")[0]
          .trim()
          .toLowerCase();

      if (
        !isSupportedImageMime(
          resolvedMime
        )
      ) {
        throw new Error(
          "The resolved Asset Vault file is not a supported raster image."
        );
      }

      if (
        bytes.byteLength >
        12 * 1024 * 1024
      ) {
        throw new Error(
          "This image is larger than the 12 MB visual inspection limit."
        );
      }

      return {
        content: [
          {
            type:
              "text",

            text:
              JSON.stringify(
                {
                  id:
                    asset.id,

                  brand_id:
                    asset.brand_id,

                  name:
                    asset.name,

                  description:
                    asset.description,

                  alt_text:
                    asset.alt_text,

                  tags:
                    asset.tags,

                  approved_for_ai:
                    asset.approved_for_ai,

                  approved_for_marketing:
                    asset.approved_for_marketing
                },
                null,
                2
              )
          },
          {
            type:
              "image",

            data:
              bytes.toString(
                "base64"
              ),

            mimeType:
              resolvedMime
          }
        ]
      };
    }
  );


  /* --------------------------------------
     SAVE GENERATED ASSET
     -------------------------------------- */

  server.registerTool(
    "save_generated_asset",
    {
      title:
        "Save Generated Image",

      description:
        "Save one image generated or edited in ChatGPT into the selected brand's private Asset Vault. Generated artwork is left unapproved, routed to the pinned Newly Created folder, and can optionally be attached to a Content Studio item. This does not publish or schedule anything.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        content_id:
          z.string().uuid().nullable().optional(),

        name:
          z.string().trim().min(1).max(180),

        description:
          z.string().max(2000).nullable().optional(),

        alt_text:
          z.string().max(500).nullable().optional(),

        tags:
          z.array(
            z.string().trim().min(1).max(80)
          )
          .max(30)
          .optional(),

        role:
          z.enum([
            "primary",
            "supporting",
            "reference"
          ])
          .optional(),

        file:
          OpenAIFileSchema
      },

      securitySchemes: [
        {
          type:
            "oauth2",

          scopes: []
        }
      ],

      annotations: {
        readOnlyHint:
          false,

        destructiveHint:
          false,

        idempotentHint:
          false,

        openWorldHint:
          true
      },

      _meta: {
        "openai/fileParams": [
          "file"
        ],

        "openai/toolInvocation/invoking":
          "Saving image to the Asset Vault…",

        "openai/toolInvocation/invoked":
          "Image saved to the Asset Vault"
      }
    },

    async ({
      brand_id,
      content_id,
      name,
      description,
      alt_text,
      tags,
      role,
      file
    }) => {
      const brand =
        await select(
          "brands",

          supabase
            .from("brands")
            .select(
              [
                "id",
                "official_name"
              ].join(",")
            )
            .eq(
              "id",
              brand_id
            )
            .eq(
              "active",
              true
            )
            .single()
        );

      if (!brand?.id) {
        throw new Error(
          "Brand not found."
        );
      }

      if (content_id) {
        const content =
          await select(
            "content_items",

            supabase
              .from(
                "content_items"
              )
              .select(
                [
                  "id",
                  "brand_id"
                ].join(",")
              )
              .eq(
                "id",
                content_id
              )
              .single()
          );

        if (
          !content?.id ||
          content.brand_id !==
            brand_id
        ) {
          throw new Error(
            "The selected Content Studio item does not belong to this brand."
          );
        }
      }

      const user =
        authenticatedUser;

      if (!user?.id) {
        throw new Error(
          "The signed-in Marketing Studio user could not be resolved."
        );
      }

      const downloadUrl =
        new URL(
          file.download_url
        );

      if (
        downloadUrl.protocol !==
        "https:"
      ) {
        throw new Error(
          "ChatGPT file downloads must use HTTPS."
        );
      }

      const response =
        await fetch(
          downloadUrl,
          {
            redirect:
              "follow"
          }
        );

      if (!response.ok) {
        throw new Error(
          "ChatGPT's temporary image file could not be downloaded."
        );
      }

      const responseMime =
        String(
          file.mime_type ||
          response.headers.get(
            "content-type"
          ) ||
          "image/png"
        )
          .split(";")[0]
          .trim()
          .toLowerCase();

      if (
        !isSupportedImageMime(
          responseMime
        )
      ) {
        throw new Error(
          "Only PNG, JPEG, WebP, or GIF image files can be saved with this tool."
        );
      }

      const bytes =
        Buffer.from(
          await response.arrayBuffer()
        );

      if (
        bytes.byteLength >
        25 * 1024 * 1024
      ) {
        throw new Error(
          "The image exceeds the 25 MB Asset Vault limit."
        );
      }

      const originalBase =
        file.file_name
          ? file.file_name.replace(
              /\.[^.]+$/,
              ""
            )
          : name;

      const extension =
        extensionForMime(
          responseMime
        );

      const filename =
        safeFileBase(
          originalBase
        ) +
        "-" +
        crypto.randomUUID()
          .slice(
            0,
            8
          ) +
        "." +
        extension;

      const storagePath =
        user.id +
        "/" +
        brand_id +
        "/" +
        filename;

      const {
        error:
          uploadError
      } =
        await supabase.storage
          .from(
            "brand-assets"
          )
          .upload(
            storagePath,
            bytes,
            {
              contentType:
                responseMime,

              cacheControl:
                "3600",

              upsert:
                false
            }
          );

      if (uploadError) {
        throw new Error(
          "Asset Vault upload failed: " +
          uploadError.message
        );
      }

      let asset;

      try {
        const finalTags =
          Array.from(
            new Set([
              "generated",
              "chatgpt",
              "content-studio",
              ...(
                tags ||
                []
              )
            ])
          );

        const {
          data,
          error
        } =
          await supabase
            .from("assets")
            .insert({
              brand_id,

              asset_type:
                "generated_artwork",

              name,

              description:
                description ??
                "Generated in ChatGPT for Content Studio.",

              storage_bucket:
                "brand-assets",

              storage_path:
                storagePath,

              external_url:
                null,

              mime_type:
                responseMime,

              alt_text:
                alt_text ??
                null,

              tags:
                finalTags,

              approved_for_ai:
                false,

              approved_for_marketing:
                false,

              active:
                true
            })
            .select()
            .single();

        if (error) {
          throw new Error(
            "Asset record failed: " +
            error.message
          );
        }

        asset =
          data;

      } catch (error) {
        await supabase.storage
          .from(
            "brand-assets"
          )
          .remove([
            storagePath
          ]);

        throw error;
      }

      let contentLink =
        null;

      if (content_id) {
        const {
          data,
          error
        } =
          await supabase
            .from(
              "content_assets"
            )
            .upsert(
              {
                content_id,

                asset_id:
                  asset.id,

                role:
                  role ||
                  "primary"
              },
              {
                onConflict:
                  "content_id,asset_id"
              }
            )
            .select()
            .single();

        if (error) {
          throw new Error(
            "The image was saved, but attaching it to the Content Studio item failed: " +
            error.message
          );
        }

        contentLink =
          data;
      }

      return jsonResult({
        ok:
          true,

        asset,

        content_link:
          contentLink,

        note:
          "Saved to the brand's pinned Newly Created folder. The image remains unapproved until the owner reviews it."
      });
    }
  );


  /* --------------------------------------
     UPDATE CONTENT
     -------------------------------------- */

  server.registerTool(
    "update_content",
    {
      title:
        "Update Content",

      description:
        "Update an existing Black Stag Marketing Studio content item. Only fields provided are changed.",

      inputSchema: {
        content_id:
          z.string().uuid(),

        title:
          z.string().trim().min(1).nullable().optional(),

        body:
          z.string().nullable().optional(),

        content_type:
          z.enum([
            "social_post",
            "story",
            "reel_script",
            "email",
            "website_copy",
            "promotional_graphic",
            "campaign",
            "other"
          ]).optional(),

        status:
          z.enum([
            "idea",
            "draft",
            "review",
            "approved",
            "scheduled",
            "published",
            "rejected"
          ]).optional(),

        platform:
          z.string().trim().min(1).nullable().optional(),

        goal:
          z.string().trim().min(1).nullable().optional(),

        alternate_copy:
          z.string().nullable().optional(),

        visual_direction:
          z.string().nullable().optional(),

        cta:
          z.string().nullable().optional(),

        hashtags:
          z.array(
            z.string().trim().min(1)
          ).optional(),

        campaign_id:
          z.string().uuid().nullable().optional(),

        scheduled_for:
          z.string().datetime().nullable().optional(),

        rejection_reason:
          z.string().nullable().optional()
      },

      ...writeToolMetadata
    },

    async ({
      content_id,
      ...changes
    }) => {
      const payload = {
        ...changes,
        updated_at:
          new Date().toISOString()
      };

      const {
        data,
        error
      } =
        await supabase
          .from("content_items")
          .update(payload)
          .eq(
            "id",
            content_id
          )
          .select()
          .single();

      if (error) {
        throw new Error(
          `content_items: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     CREATE CAMPAIGN
     -------------------------------------- */

  server.registerTool(
    "create_campaign",
    {
      title:
        "Create Campaign",

      description:
        "Create a new campaign for one brand. Campaigns are created as drafts unless another valid status is supplied.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        name:
          z.string().trim().min(1),

        description:
          z.string().nullable().optional(),

        objective:
          z.string().nullable().optional(),

        status:
          z.enum([
            "draft",
            "active",
            "completed",
            "archived"
          ]).optional(),

        audience_notes:
          z.string().nullable().optional(),

        offer_text:
          z.string().nullable().optional(),

        budget_notes:
          z.string().nullable().optional(),

        channels:
          z.array(
            z.string().trim().min(1)
          ).optional(),

        voice_notes:
          z.string().nullable().optional(),

        cta:
          z.string().nullable().optional(),

        starts_on:
          z.string().date().nullable().optional(),

        ends_on:
          z.string().date().nullable().optional()
      },

      ...writeToolMetadata
    },

    async ({
      brand_id,
      name,
      description,
      objective,
      status,
      audience_notes,
      offer_text,
      budget_notes,
      channels,
      voice_notes,
      cta,
      starts_on,
      ends_on
    }) => {
      const payload = {
        brand_id,
        name,
        description:
          description ?? null,
        objective:
          objective ?? null,
        status:
          status || "draft",
        audience_notes:
          audience_notes ?? null,
        offer_text:
          offer_text ?? null,
        budget_notes:
          budget_notes ?? null,
        channels:
          channels || [],
        voice_notes:
          voice_notes ?? null,
        cta:
          cta ?? null,
        starts_on:
          starts_on ?? null,
        ends_on:
          ends_on ?? null
      };

      const {
        data,
        error
      } =
        await supabase
          .from("campaigns")
          .insert(payload)
          .select()
          .single();

      if (error) {
        throw new Error(
          `campaigns: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     UPDATE CAMPAIGN
     -------------------------------------- */

  server.registerTool(
    "update_campaign",
    {
      title:
        "Update Campaign",

      description:
        "Update an existing Black Stag Marketing Studio campaign. Only supplied fields are changed.",

      inputSchema: {
        campaign_id:
          z.string().uuid(),

        name:
          z.string().trim().min(1).optional(),

        description:
          z.string().nullable().optional(),

        objective:
          z.string().nullable().optional(),

        status:
          z.enum([
            "draft",
            "active",
            "completed",
            "archived"
          ]).optional(),

        audience_notes:
          z.string().nullable().optional(),

        offer_text:
          z.string().nullable().optional(),

        budget_notes:
          z.string().nullable().optional(),

        channels:
          z.array(
            z.string().trim().min(1)
          ).optional(),

        voice_notes:
          z.string().nullable().optional(),

        cta:
          z.string().nullable().optional(),

        starts_on:
          z.string().date().nullable().optional(),

        ends_on:
          z.string().date().nullable().optional(),

        results:
          z.string().nullable().optional(),

        lessons:
          z.string().nullable().optional()
      },

      ...writeToolMetadata
    },

    async ({
      campaign_id,
      ...changes
    }) => {
      const payload = {
        ...changes,
        updated_at:
          new Date().toISOString()
      };

      const {
        data,
        error
      } =
        await supabase
          .from("campaigns")
          .update(payload)
          .eq(
            "id",
            campaign_id
          )
          .select()
          .single();

      if (error) {
        throw new Error(
          `campaigns: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     CREATE CALENDAR ITEM
     -------------------------------------- */

  server.registerTool(
    "create_calendar_item",
    {
      title:
        "Create Calendar Item",

      description:
        "Create a calendar item for one brand. This writes to the Studio calendar but does not publish external content.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        item_type:
          z.string().trim().min(1).optional(),

        title:
          z.string().trim().min(1),

        description:
          z.string().nullable().optional(),

        starts_at:
          z.string().datetime().nullable().optional(),

        ends_at:
          z.string().datetime().nullable().optional(),

        all_day:
          z.boolean().optional(),

        recurring:
          z.boolean().optional(),

        recurrence_rule:
          z.string().nullable().optional(),

        marketing_relevant:
          z.boolean().optional(),

        source_type:
          z.string().nullable().optional(),

        confirmed:
          z.boolean().optional()
      },

      ...writeToolMetadata
    },

    async ({
      brand_id,
      item_type,
      title,
      description,
      starts_at,
      ends_at,
      all_day,
      recurring,
      recurrence_rule,
      marketing_relevant,
      source_type,
      confirmed
    }) => {
      const payload = {
        brand_id,
        item_type:
          item_type || "event",
        title,
        description:
          description ?? null,
        starts_at:
          starts_at ?? null,
        ends_at:
          ends_at ?? null,
        all_day:
          all_day ?? false,
        recurring:
          recurring ?? false,
        recurrence_rule:
          recurrence_rule ?? null,
        marketing_relevant:
          marketing_relevant ?? true,
        source_type:
          source_type || "chatgpt-mcp",
        confirmed:
          confirmed ?? true
      };

      const {
        data,
        error
      } =
        await supabase
          .from("calendar_items")
          .insert(payload)
          .select()
          .single();

      if (error) {
        throw new Error(
          `calendar_items: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     UPDATE CALENDAR ITEM
     -------------------------------------- */

  server.registerTool(
    "update_calendar_item",
    {
      title:
        "Update Calendar Item",

      description:
        "Update an existing Black Stag Marketing Studio calendar item. Only supplied fields are changed.",

      inputSchema: {
        calendar_item_id:
          z.string().uuid(),

        item_type:
          z.string().trim().min(1).optional(),

        title:
          z.string().trim().min(1).optional(),

        description:
          z.string().nullable().optional(),

        starts_at:
          z.string().datetime().nullable().optional(),

        ends_at:
          z.string().datetime().nullable().optional(),

        all_day:
          z.boolean().optional(),

        recurring:
          z.boolean().optional(),

        recurrence_rule:
          z.string().nullable().optional(),

        marketing_relevant:
          z.boolean().optional(),

        source_type:
          z.string().nullable().optional(),

        confirmed:
          z.boolean().optional()
      },

      ...writeToolMetadata
    },

    async ({
      calendar_item_id,
      ...changes
    }) => {
      const payload = {
        ...changes,
        updated_at:
          new Date().toISOString()
      };

      const {
        data,
        error
      } =
        await supabase
          .from("calendar_items")
          .update(payload)
          .eq(
            "id",
            calendar_item_id
          )
          .select()
          .single();

      if (error) {
        throw new Error(
          `calendar_items: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     CREATE ASSET FOLDER
     -------------------------------------- */

  server.registerTool(
    "create_asset_folder",
    {
      title:
        "Create Asset Folder",

      description:
        "Create an Asset Vault folder for one brand. Supports nested folders through parent_folder_id.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        name:
          z.string().trim().min(1),

        description:
          z.string().optional(),

        parent_folder_id:
          z.string().uuid().nullable().optional()
      },

      ...writeToolMetadata
    },

    async ({
      brand_id,
      name,
      description,
      parent_folder_id
    }) => {
      const payload = {
        brand_id,
        name,
        description:
          description || "",
        parent_folder_id:
          parent_folder_id ?? null
      };

      const {
        data,
        error
      } =
        await supabase
          .from("asset_folders")
          .insert(payload)
          .select()
          .single();

      if (error) {
        throw new Error(
          `asset_folders: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     CREATE ASSET METADATA
     -------------------------------------- */

  server.registerTool(
    "create_asset",
    {
      title:
        "Create Asset Record",

      description:
        "Create Asset Vault metadata for a file or external asset. This records the asset in the Studio but does not upload binary file bytes.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        asset_type:
          z.enum([
            "logo",
            "photo",
            "generated_artwork",
            "brand_asset",
            "document",
            "other"
          ]),

        name:
          z.string().trim().min(1),

        description:
          z.string().nullable().optional(),

        folder_id:
          z.string().uuid().nullable().optional(),

        external_url:
          z.string().url().nullable().optional(),

        storage_bucket:
          z.string().trim().min(1).nullable().optional(),

        storage_path:
          z.string().trim().min(1).nullable().optional(),

        mime_type:
          z.string().trim().min(1).nullable().optional(),

        width:
          z.number().int().positive().nullable().optional(),

        height:
          z.number().int().positive().nullable().optional(),

        alt_text:
          z.string().nullable().optional(),

        tags:
          z.array(
            z.string().trim().min(1)
          ).optional(),

        approved_for_ai:
          z.boolean().optional(),

        approved_for_marketing:
          z.boolean().optional()
      },

      ...writeToolMetadata
    },

    async ({
      brand_id,
      asset_type,
      name,
      description,
      folder_id,
      external_url,
      storage_bucket,
      storage_path,
      mime_type,
      width,
      height,
      alt_text,
      tags,
      approved_for_ai,
      approved_for_marketing
    }) => {
      const payload = {
        brand_id,
        asset_type,
        name,
        description:
          description ?? null,
        folder_id:
          folder_id ?? null,
        external_url:
          external_url ?? null,
        storage_bucket:
          storage_bucket ?? null,
        storage_path:
          storage_path ?? null,
        mime_type:
          mime_type ?? null,
        width:
          width ?? null,
        height:
          height ?? null,
        alt_text:
          alt_text ?? null,
        tags:
          tags || [],
        approved_for_ai:
          approved_for_ai ?? true,
        approved_for_marketing:
          approved_for_marketing ?? true,
        active:
          true
      };

      const {
        data,
        error
      } =
        await supabase
          .from("assets")
          .insert(payload)
          .select()
          .single();

      if (error) {
        throw new Error(
          `assets: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );


  /* --------------------------------------
     CREATE MARKETING PLAN
     -------------------------------------- */

  server.registerTool(
    "create_marketing_plan",
    {
      title:
        "Create Marketing Plan",

      description:
        "Create a coordinated draft marketing plan inside Black Stag Marketing Studio: one campaign plus optional content drafts, calendar items, and an Asset Vault folder. This does not publish anything externally.",

      inputSchema: {
        brand_id:
          z.string().uuid(),

        campaign: z.object({
          name:
            z.string().trim().min(1),

          description:
            z.string().nullable().optional(),

          objective:
            z.string().nullable().optional(),

          audience_notes:
            z.string().nullable().optional(),

          offer_text:
            z.string().nullable().optional(),

          budget_notes:
            z.string().nullable().optional(),

          channels:
            z.array(
              z.string().trim().min(1)
            ).optional(),

          voice_notes:
            z.string().nullable().optional(),

          cta:
            z.string().nullable().optional(),

          starts_on:
            z.string().date().nullable().optional(),

          ends_on:
            z.string().date().nullable().optional()
        }),

        content_items:
          z.array(
            z.object({
              content_type:
                z.enum([
                  "social_post",
                  "story",
                  "reel_script",
                  "email",
                  "website_copy",
                  "promotional_graphic",
                  "campaign",
                  "other"
                ]),

              title:
                z.string().trim().min(1).optional(),

              body:
                z.string().trim().min(1),

              platform:
                z.string().trim().min(1).optional(),

              goal:
                z.string().trim().min(1).optional(),

              cta:
                z.string().optional(),

              hashtags:
                z.array(
                  z.string().trim().min(1)
                ).optional(),

              visual_direction:
                z.string().optional(),

              scheduled_for:
                z.string().datetime().nullable().optional()
            })
          ).optional(),

        calendar_items:
          z.array(
            z.object({
              item_type:
                z.string().trim().min(1).optional(),

              title:
                z.string().trim().min(1),

              description:
                z.string().nullable().optional(),

              starts_at:
                z.string().datetime().nullable().optional(),

              ends_at:
                z.string().datetime().nullable().optional(),

              all_day:
                z.boolean().optional(),

              marketing_relevant:
                z.boolean().optional(),

              confirmed:
                z.boolean().optional()
            })
          ).optional(),

        asset_folder:
          z.object({
            name:
              z.string().trim().min(1),

            description:
              z.string().optional(),

            parent_folder_id:
              z.string().uuid().nullable().optional()
          }).optional()
      },

      ...writeToolMetadata
    },

    async ({
      brand_id,
      campaign,
      content_items,
      calendar_items,
      asset_folder
    }) => {
      const created = {
        campaign: null,
        content_items: [],
        calendar_items: [],
        asset_folder: null
      };

      const {
        data: createdCampaign,
        error: campaignError
      } =
        await supabase
          .from("campaigns")
          .insert({
            brand_id,
            name:
              campaign.name,
            description:
              campaign.description ?? null,
            objective:
              campaign.objective ?? null,
            status:
              "draft",
            audience_notes:
              campaign.audience_notes ?? null,
            offer_text:
              campaign.offer_text ?? null,
            budget_notes:
              campaign.budget_notes ?? null,
            channels:
              campaign.channels || [],
            voice_notes:
              campaign.voice_notes ?? null,
            cta:
              campaign.cta ?? null,
            starts_on:
              campaign.starts_on ?? null,
            ends_on:
              campaign.ends_on ?? null
          })
          .select()
          .single();

      if (campaignError) {
        throw new Error(
          `campaigns: ${campaignError.message}`
        );
      }

      created.campaign =
        createdCampaign;

      if (
        Array.isArray(
          content_items
        ) &&
        content_items.length
      ) {
        const rows =
          content_items.map(
            item => ({
              brand_id,
              campaign_id:
                createdCampaign.id,
              content_type:
                item.content_type,
              status:
                item.scheduled_for
                  ? "scheduled"
                  : "draft",
              title:
                item.title || null,
              body:
                item.body,
              platform:
                item.platform || null,
              goal:
                item.goal || null,
              cta:
                item.cta || null,
              hashtags:
                item.hashtags || [],
              visual_direction:
                item.visual_direction || null,
              scheduled_for:
                item.scheduled_for ?? null,
              ai_mode:
                "chatgpt-mcp"
            })
          );

        const {
          data,
          error
        } =
          await supabase
            .from("content_items")
            .insert(rows)
            .select();

        if (error) {
          throw new Error(
            `content_items: ${error.message}`
          );
        }

        created.content_items =
          data || [];
      }

      if (
        Array.isArray(
          calendar_items
        ) &&
        calendar_items.length
      ) {
        const rows =
          calendar_items.map(
            item => ({
              brand_id,
              item_type:
                item.item_type ||
                "event",
              title:
                item.title,
              description:
                item.description ?? null,
              starts_at:
                item.starts_at ?? null,
              ends_at:
                item.ends_at ?? null,
              all_day:
                item.all_day ?? false,
              recurring:
                false,
              recurrence_rule:
                null,
              marketing_relevant:
                item.marketing_relevant ?? true,
              source_type:
                "chatgpt-mcp",
              confirmed:
                item.confirmed ?? true
            })
          );

        const {
          data,
          error
        } =
          await supabase
            .from("calendar_items")
            .insert(rows)
            .select();

        if (error) {
          throw new Error(
            `calendar_items: ${error.message}`
          );
        }

        created.calendar_items =
          data || [];
      }

      if (asset_folder) {
        const {
          data,
          error
        } =
          await supabase
            .from("asset_folders")
            .insert({
              brand_id,
              parent_folder_id:
                asset_folder
                  .parent_folder_id ??
                null,
              name:
                asset_folder.name,
              description:
                asset_folder
                  .description ||
                ""
            })
            .select()
            .single();

        if (error) {
          throw new Error(
            `asset_folders: ${error.message}`
          );
        }

        created.asset_folder =
          data;
      }

      return jsonResult(created);
    }
  );


  /* --------------------------------------
     EMBER WORK QUEUE
     -------------------------------------- */

  server.registerTool(
    "list_work_items",
    {
      title: "List Work Items",
      description:
        "List persistent Ember/owner/shared work items for one brand. Read-only.",
      inputSchema: {
        brand_id: z.string().uuid(),
        status: z.enum([
          "open",
          "in_progress",
          "blocked",
          "waiting",
          "done",
          "cancelled"
        ]).optional(),
        owner_type: z.enum([
          "owner",
          "ember",
          "shared"
        ]).optional()
      },
      ...readOnlyToolMetadata
    },
    async ({
      brand_id,
      status,
      owner_type
    }) => {
      let query =
        supabase
          .from("work_items")
          .select("*")
          .eq("brand_id", brand_id)
          .order("due_at", {
            ascending: true,
            nullsFirst: false
          })
          .order("created_at", {
            ascending: false
          });

      if (status) {
        query =
          query.eq(
            "status",
            status
          );
      }

      if (owner_type) {
        query =
          query.eq(
            "owner_type",
            owner_type
          );
      }

      const rows =
        await select(
          "work_items",
          query
        );

      return jsonResult(rows);
    }
  );

  server.registerTool(
    "create_work_item",
    {
      title: "Create Work Item",
      description:
        "Create a persistent work item in Marketing Studio for the owner, Ember, or both. Does not publish anything externally.",
      inputSchema: {
        brand_id: z.string().uuid(),
        title: z.string().trim().min(1),
        description: z.string().nullable().optional(),
        work_type: z.enum([
          "task",
          "content",
          "campaign",
          "asset",
          "research",
          "follow_up",
          "admin",
          "other"
        ]).optional(),
        priority: z.enum([
          "low",
          "normal",
          "high",
          "urgent"
        ]).optional(),
        owner_type: z.enum([
          "owner",
          "ember",
          "shared"
        ]).optional(),
        due_at: z.string().datetime().nullable().optional(),
        related_type: z.string().trim().min(1).nullable().optional(),
        related_id: z.string().uuid().nullable().optional(),
        notes: z.string().nullable().optional()
      },
      ...writeToolMetadata
    },
    async ({
      brand_id,
      title,
      description,
      work_type,
      priority,
      owner_type,
      due_at,
      related_type,
      related_id,
      notes
    }) => {
      const {
        data,
        error
      } =
        await supabase
          .from("work_items")
          .insert({
            brand_id,
            title,
            description:
              description ?? null,
            work_type:
              work_type || "task",
            priority:
              priority || "normal",
            owner_type:
              owner_type || "shared",
            due_at:
              due_at ?? null,
            related_type:
              related_type ?? null,
            related_id:
              related_id ?? null,
            notes:
              notes ?? null
          })
          .select()
          .single();

      if (error) {
        throw new Error(
          `work_items: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );

  server.registerTool(
    "update_work_item",
    {
      title: "Update Work Item",
      description:
        "Update a persistent Marketing Studio work item. Only supplied fields are changed.",
      inputSchema: {
        work_item_id: z.string().uuid(),
        title: z.string().trim().min(1).optional(),
        description: z.string().nullable().optional(),
        work_type: z.enum([
          "task",
          "content",
          "campaign",
          "asset",
          "research",
          "follow_up",
          "admin",
          "other"
        ]).optional(),
        status: z.enum([
          "open",
          "in_progress",
          "blocked",
          "waiting",
          "done",
          "cancelled"
        ]).optional(),
        priority: z.enum([
          "low",
          "normal",
          "high",
          "urgent"
        ]).optional(),
        owner_type: z.enum([
          "owner",
          "ember",
          "shared"
        ]).optional(),
        due_at: z.string().datetime().nullable().optional(),
        related_type: z.string().trim().min(1).nullable().optional(),
        related_id: z.string().uuid().nullable().optional(),
        blocked_reason: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      },
      ...writeToolMetadata
    },
    async ({
      work_item_id,
      ...changes
    }) => {
      const payload = {
        ...changes
      };

      if (
        changes.status === "done"
      ) {
        payload.completed_at =
          new Date().toISOString();
      }

      if (
        changes.status &&
        changes.status !== "done"
      ) {
        payload.completed_at =
          null;
      }

      const {
        data,
        error
      } =
        await supabase
          .from("work_items")
          .update(payload)
          .eq("id", work_item_id)
          .select()
          .single();

      if (error) {
        throw new Error(
          `work_items: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );

  /* --------------------------------------
     EMBER DECISION QUEUE
     -------------------------------------- */

  server.registerTool(
    "list_decision_requests",
    {
      title: "List Decision Requests",
      description:
        "List decisions waiting for the owner or previously answered/deferred for one brand. Read-only.",
      inputSchema: {
        brand_id: z.string().uuid(),
        status: z.enum([
          "pending",
          "answered",
          "deferred",
          "dismissed"
        ]).optional()
      },
      ...readOnlyToolMetadata
    },
    async ({
      brand_id,
      status
    }) => {
      let query =
        supabase
          .from(
            "decision_requests"
          )
          .select("*")
          .eq("brand_id", brand_id)
          .order("due_at", {
            ascending: true,
            nullsFirst: false
          })
          .order("created_at", {
            ascending: false
          });

      if (status) {
        query =
          query.eq(
            "status",
            status
          );
      }

      const rows =
        await select(
          "decision_requests",
          query
        );

      return jsonResult(rows);
    }
  );

  server.registerTool(
    "create_decision_request",
    {
      title: "Create Decision Request",
      description:
        "Create a decision for the owner to review in Marketing Studio. May include options and an Ember recommendation, but never decides on the owner's behalf.",
      inputSchema: {
        brand_id: z.string().uuid(),
        title: z.string().trim().min(1),
        context: z.string().nullable().optional(),
        question: z.string().trim().min(1),
        options: z.array(
          z.object({
            label: z.string().trim().min(1),
            description: z.string().optional()
          })
        ).optional(),
        ember_recommendation: z.string().nullable().optional(),
        priority: z.enum([
          "low",
          "normal",
          "high",
          "urgent"
        ]).optional(),
        due_at: z.string().datetime().nullable().optional(),
        related_type: z.string().trim().min(1).nullable().optional(),
        related_id: z.string().uuid().nullable().optional()
      },
      ...writeToolMetadata
    },
    async ({
      brand_id,
      title,
      context,
      question,
      options,
      ember_recommendation,
      priority,
      due_at,
      related_type,
      related_id
    }) => {
      const {
        data,
        error
      } =
        await supabase
          .from(
            "decision_requests"
          )
          .insert({
            brand_id,
            title,
            context:
              context ?? null,
            question,
            options:
              options || [],
            ember_recommendation:
              ember_recommendation ??
              null,
            priority:
              priority || "normal",
            due_at:
              due_at ?? null,
            related_type:
              related_type ?? null,
            related_id:
              related_id ?? null
          })
          .select()
          .single();

      if (error) {
        throw new Error(
          `decision_requests: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );

  server.registerTool(
    "answer_decision_request",
    {
      title: "Answer Decision Request",
      description:
        "Record the owner's answer, defer, or dismiss a Marketing Studio decision request.",
      inputSchema: {
        decision_request_id:
          z.string().uuid(),
        status:
          z.enum([
            "answered",
            "deferred",
            "dismissed"
          ]),
        answer:
          z.string().nullable().optional()
      },
      ...writeToolMetadata
    },
    async ({
      decision_request_id,
      status,
      answer
    }) => {
      const {
        data,
        error
      } =
        await supabase
          .from(
            "decision_requests"
          )
          .update({
            status,
            answer:
              answer ?? null,
            answered_at:
              status === "answered"
                ? new Date().toISOString()
                : null
          })
          .eq(
            "id",
            decision_request_id
          )
          .select()
          .single();

      if (error) {
        throw new Error(
          `decision_requests: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );

  /* --------------------------------------
     MARKETING FEEDBACK / LEARNING
     -------------------------------------- */

  server.registerTool(
    "list_marketing_feedback",
    {
      title: "List Marketing Feedback",
      description:
        "List active owner feedback and learned marketing rules for one brand. Read-only.",
      inputSchema: {
        brand_id: z.string().uuid()
      },
      ...readOnlyToolMetadata
    },
    async ({ brand_id }) => {
      const rows =
        await select(
          "marketing_feedback",
          supabase
            .from(
              "marketing_feedback"
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

  server.registerTool(
    "record_marketing_feedback",
    {
      title: "Record Marketing Feedback",
      description:
        "Record owner feedback about Marketing Studio output and optionally a learned rule to apply in future work.",
      inputSchema: {
        brand_id: z.string().uuid(),
        content_id: z.string().uuid().nullable().optional(),
        feedback_type: z.string().trim().min(1).optional(),
        feedback_text: z.string().trim().min(1),
        learned_rule: z.string().nullable().optional(),
        apply_to_future: z.boolean().optional()
      },
      ...writeToolMetadata
    },
    async ({
      brand_id,
      content_id,
      feedback_type,
      feedback_text,
      learned_rule,
      apply_to_future
    }) => {
      const {
        data,
        error
      } =
        await supabase
          .from(
            "marketing_feedback"
          )
          .insert({
            brand_id,
            content_id:
              content_id ?? null,
            feedback_type:
              feedback_type ||
              "general",
            feedback_text,
            learned_rule:
              learned_rule ?? null,
            apply_to_future:
              apply_to_future ??
              true
          })
          .select()
          .single();

      if (error) {
        throw new Error(
          `marketing_feedback: ${error.message}`
        );
      }

      return jsonResult(data);
    }
  );

  /* --------------------------------------
     LIVE DAILY BRIEF
     -------------------------------------- */

  server.registerTool(
    "get_daily_brief",
    {
      title: "Get Daily Brief",
      description:
        "Build a live operating brief from Marketing Studio: brand status, open work, pending decisions, active campaigns, content workflow, upcoming calendar items, and milestones. Read-only.",
      inputSchema: {
        brand_id:
          z.string().uuid().optional(),
        horizon_days:
          z.number().int().min(1).max(30).optional()
      },
      ...readOnlyToolMetadata
    },
    async ({
      brand_id,
      horizon_days
    }) => {
      const horizonDays =
        horizon_days || 7;
      const now =
        new Date();
      const horizon =
        new Date(
          now.getTime() +
          horizonDays *
          24 *
          60 *
          60 *
          1000
        );

      let brandsQuery =
        supabase
          .from("brands")
          .select(
            [
              "id",
              "official_name",
              "short_name",
              "business_stage",
              "stage_label",
              "primary_marketing_goal",
              "campaign_phase",
              "opening_date",
              "opening_date_confirmed"
            ].join(",")
          )
          .eq("active", true)
          .order("created_at", {
            ascending: true
          });

      if (brand_id) {
        brandsQuery =
          brandsQuery.eq(
            "id",
            brand_id
          );
      }

      const brands =
        await select(
          "brands",
          brandsQuery
        );

      const brief = [];

      for (const brand of brands) {
        const [
          workItems,
          decisions,
          campaigns,
          contentItems,
          calendarItems,
          milestones
        ] =
          await Promise.all([
            select(
              "work_items",
              supabase
                .from("work_items")
                .select(
                  [
                    "id",
                    "title",
                    "description",
                    "work_type",
                    "status",
                    "priority",
                    "owner_type",
                    "due_at",
                    "blocked_reason",
                    "related_type",
                    "related_id"
                  ].join(",")
                )
                .eq(
                  "brand_id",
                  brand.id
                )
                .not(
                  "status",
                  "in",
                  '("done","cancelled")'
                )
                .order(
                  "due_at",
                  {
                    ascending: true,
                    nullsFirst: false
                  }
                )
                .limit(12)
            ),

            select(
              "decision_requests",
              supabase
                .from(
                  "decision_requests"
                )
                .select(
                  [
                    "id",
                    "title",
                    "context",
                    "question",
                    "options",
                    "ember_recommendation",
                    "status",
                    "priority",
                    "due_at"
                  ].join(",")
                )
                .eq(
                  "brand_id",
                  brand.id
                )
                .in(
                  "status",
                  [
                    "pending",
                    "deferred"
                  ]
                )
                .order(
                  "due_at",
                  {
                    ascending: true,
                    nullsFirst: false
                  }
                )
                .limit(8)
            ),

            select(
              "campaigns",
              supabase
                .from("campaigns")
                .select(
                  [
                    "id",
                    "name",
                    "status",
                    "objective",
                    "channels",
                    "starts_on",
                    "ends_on"
                  ].join(",")
                )
                .eq(
                  "brand_id",
                  brand.id
                )
                .in(
                  "status",
                  [
                    "draft",
                    "active"
                  ]
                )
                .order(
                  "created_at",
                  {
                    ascending: false
                  }
                )
                .limit(8)
            ),

            select(
              "content_items",
              supabase
                .from(
                  "content_items"
                )
                .select(
                  [
                    "id",
                    "title",
                    "content_type",
                    "status",
                    "platform",
                    "scheduled_for",
                    "campaign_id"
                  ].join(",")
                )
                .eq(
                  "brand_id",
                  brand.id
                )
                .order(
                  "updated_at",
                  {
                    ascending: false
                  }
                )
                .limit(100)
            ),

            select(
              "calendar_items",
              supabase
                .from(
                  "calendar_items"
                )
                .select(
                  [
                    "id",
                    "title",
                    "item_type",
                    "starts_at",
                    "ends_at",
                    "all_day",
                    "marketing_relevant",
                    "confirmed"
                  ].join(",")
                )
                .eq(
                  "brand_id",
                  brand.id
                )
                .gte(
                  "starts_at",
                  now.toISOString()
                )
                .lte(
                  "starts_at",
                  horizon.toISOString()
                )
                .order(
                  "starts_at",
                  {
                    ascending: true
                  }
                )
                .limit(20)
            ),

            select(
              "milestones",
              supabase
                .from("milestones")
                .select(
                  [
                    "id",
                    "title",
                    "description",
                    "status",
                    "milestone_date",
                    "marketing_worthy",
                    "content_created"
                  ].join(",")
                )
                .eq(
                  "brand_id",
                  brand.id
                )
                .in(
                  "status",
                  [
                    "planned",
                    "in_progress"
                  ]
                )
                .order(
                  "milestone_date",
                  {
                    ascending: true,
                    nullsFirst: false
                  }
                )
                .limit(12)
            )
          ]);

        const contentByStatus =
          contentItems.reduce(
            (acc, item) => {
              acc[item.status] =
                (acc[item.status] || 0) +
                1;
              return acc;
            },
            {}
          );

        const scheduledSoon =
          contentItems.filter(
            (item) => {
              if (!item.scheduled_for) {
                return false;
              }

              const when =
                new Date(
                  item.scheduled_for
                );

              return (
                when >= now &&
                when <= horizon
              );
            }
          );

        brief.push({
          brand,
          work_items: workItems,
          decisions,
          campaigns,
          content: {
            counts_by_status:
              contentByStatus,
            scheduled_next:
              horizonDays,
            scheduled_items:
              scheduledSoon
          },
          calendar:
            calendarItems,
          milestones
        });
      }

      return jsonResult({
        generated_at:
          now.toISOString(),
        horizon_days:
          horizonDays,
        brands:
          brief
      });
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
      access to your Black Stag
      Marketing Studio data.
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
      mode: "read-write"
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
      req.supabase,
      req.supabaseUser
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
  "0.0.0.0",
  () => {
    console.log(
      `Black Stag MCP listening on port ${port} (read-write)`
    );
  }
);