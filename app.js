/* =========================================================
   BLACK STAG MARKETING STUDIO
   app.js
   v3

   Supabase-connected application shell:
   - Authentication
   - Persistent authenticated session
   - Supabase Brand Brain loading
   - Supabase content persistence
   - Campaign loading
   - Calendar loading
   - Asset metadata loading
   - Navigation
   - Brand switching
   - Quick Create
   - Manual ChatGPT AI workflow
   - AI brief generation
   - Copy-to-clipboard
   - Paste-result workflow
   - Filters
   - Dialogs
   - Toasts

   V1 AI MODE:
   ChatGPT Manual

   ========================================================= */

"use strict";


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function safeDialogOpen(dialog) {
  if (!dialog) {
    return;
  }

  if (!dialog.open) {
    dialog.showModal();
  }
}


function safeDialogClose(dialog) {
  if (!dialog) {
    return;
  }

  if (dialog.open) {
    dialog.close();
  }
}


/* =========================================================
   CONFIG
   ========================================================= */

const CONFIG =
  window.BLACK_STAG_CONFIG || {};


const SUPABASE_CONFIG =
  CONFIG.supabase || {};


const SUPABASE_URL =
  SUPABASE_CONFIG.url || "";


const SUPABASE_KEY =
  SUPABASE_CONFIG.publishableKey ||
  SUPABASE_CONFIG.anonKey ||
  "";


/* =========================================================
   LOCAL PREFERENCES

   Supabase now stores business/content data.

   localStorage is only used for harmless UI preferences:
   - selected brand
   - selected view

   ========================================================= */

const STORAGE_KEYS = {
  activeBrand:
    "blackStagMarketingStudio.activeBrand",

  lastView:
    "blackStagMarketingStudio.lastView"
};


function readStorage(
  key,
  fallback = null
) {
  try {
    const value =
      window.localStorage.getItem(key);

    return value ?? fallback;
  } catch (error) {
    console.warn(
      "Unable to read local storage:",
      error
    );

    return fallback;
  }
}


function writeStorage(
  key,
  value
) {
  try {
    window.localStorage.setItem(
      key,
      String(value)
    );
  } catch (error) {
    console.warn(
      "Unable to write local storage:",
      error
    );
  }
}


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

let supabaseClient =
  null;


function createSupabaseClient() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      "function"
  ) {
    throw new Error(
      "The Supabase browser library did not load."
    );
  }


  if (
    !SUPABASE_URL ||
    SUPABASE_URL.includes(
      "PASTE_YOUR_PROJECT_URL_HERE"
    )
  ) {
    throw new Error(
      "The Supabase Project URL is missing from config.js."
    );
  }


  if (
    !SUPABASE_KEY ||
    SUPABASE_KEY.includes(
      "PASTE_YOUR_PUBLISHABLE_KEY_HERE"
    )
  ) {
    throw new Error(
      "The Supabase Publishable Key is missing from config.js."
    );
  }


  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          persistSession:
            true,

          autoRefreshToken:
            true,

          detectSessionInUrl:
            true
        }
      }
    );


  return supabaseClient;
}


/* =========================================================
   APP DATA

   Supabase is now the source of truth.

   ========================================================= */

const APP_DATA = {
  brands:
    [],

  campaigns:
    [],

  content:
    [],

  calendar:
    [],

  assets:
    []
};


/* =========================================================
   APP STATE
   ========================================================= */

const APP_STATE = {
  activeView:
    readStorage(
      STORAGE_KEYS.lastView,
      "dashboard"
    ),

  activeBrandId:
    readStorage(
      STORAGE_KEYS.activeBrand,
      null
    ),

  user:
    null,

  session:
    null,

  loading:
    true,

  campaignFilter:
    "all",

  contentFilter:
    "all",

  assetFilter:
    "all",

  createType:
    "social-post",

  currentAiBrief:
    "",

  currentAiRequest: {
    brandId:
      null,

    type:
      null,

    goal:
      null,

    prompt:
      null
  }
};


/* =========================================================
   VIEW DEFINITIONS
   ========================================================= */

const VALID_VIEWS = new Set([
  "dashboard",
  "brands",
  "campaigns",
  "studio",
  "calendar",
  "vault",
  "settings"
]);


const VIEW_TITLES = {
  dashboard:
    "Dashboard",

  brands:
    "Brands",

  campaigns:
    "Campaigns",

  studio:
    "Content Studio",

  calendar:
    "Calendar",

  vault:
    "Asset Vault",

  settings:
    "Settings"
};


/* =========================================================
   CONTENT TYPES
   ========================================================= */

const CREATE_TYPES = {
  "social-post": {
    label:
      "Social Post",

    dbType:
      "social_post",

    instruction:
      "Create a polished social media post.",

    defaultGoal:
      "awareness"
  },


  story: {
    label:
      "Story",

    dbType:
      "story",

    instruction:
      "Create concise social story content suitable for a short sequence or single story.",

    defaultGoal:
      "awareness"
  },


  reel: {
    label:
      "Reel / Video Script",

    dbType:
      "reel_script",

    instruction:
      "Create a short-form video or reel concept and script.",

    defaultGoal:
      "engagement"
  },


  graphic: {
    label:
      "Promotional Graphic",

    dbType:
      "promotional_graphic",

    instruction:
      "Develop the concept, visual direction, headline, supporting copy, and call to action for a promotional graphic.",

    defaultGoal:
      "awareness"
  },


  email: {
    label:
      "Email",

    dbType:
      "email",

    instruction:
      "Create a marketing email with a subject line, preview text, body copy, and appropriate call to action.",

    defaultGoal:
      "awareness"
  },


  campaign: {
    label:
      "Campaign",

    dbType:
      "campaign",

    instruction:
      "Develop a coordinated marketing campaign concept with objective, message, content ideas, recommended sequence, and calls to action.",

    defaultGoal:
      "awareness"
  },


  "website-copy": {
    label:
      "Website Copy",

    dbType:
      "website_copy",

    instruction:
      "Create polished website copy appropriate for the requested page, section, or purpose.",

    defaultGoal:
      "traffic"
  }
};


const DB_TYPE_TO_APP_TYPE = {
  social_post:
    "social-post",

  story:
    "story",

  reel_script:
    "reel",

  email:
    "email",

  website_copy:
    "website-copy",

  promotional_graphic:
    "graphic",

  campaign:
    "campaign",

  other:
    "social-post"
};


/* =========================================================
   AUTH UI
   ========================================================= */

function ensureAuthDialog() {
  let dialog =
    $("#authDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "authDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div class="dialog-header">

      <div>
        <span class="eyebrow">
          Black Stag
        </span>

        <h2>
          Marketing Studio
        </h2>
      </div>

    </div>

    <form
      class="create-form"
      id="authForm"
    >

      <p
        style="
          margin:0;
          color:var(--muted);
          font-size:.82rem;
          line-height:1.65;
        "
      >
        Sign in to your private marketing workspace.
      </p>

      <label class="field">

        <span>
          Email
        </span>

        <input
          id="authEmail"
          type="email"
          autocomplete="email"
          required
        />

      </label>

      <label class="field">

        <span>
          Password
        </span>

        <input
          id="authPassword"
          type="password"
          autocomplete="current-password"
          required
        />

      </label>

      <p
        id="authError"
        style="
          display:none;
          margin:0;
          color:#d8a09a;
          font-size:.78rem;
          line-height:1.5;
        "
      ></p>

      <button
        class="primary-button full-button"
        id="authSubmitButton"
        type="submit"
      >
        Sign In
      </button>

    </form>
  `;


  document.body.appendChild(
    dialog
  );


  $("#authForm")
    ?.addEventListener(
      "submit",
      handleSignIn
    );


  dialog.addEventListener(
    "cancel",
    event => {
      if (!APP_STATE.session) {
        event.preventDefault();
      }
    }
  );


  return dialog;
}


function showAuthDialog() {
  const dialog =
    ensureAuthDialog();


  const error =
    $("#authError");


  if (error) {
    error.textContent =
      "";

    error.style.display =
      "none";
  }


  safeDialogOpen(
    dialog
  );


  window.setTimeout(
    () => {
      $("#authEmail")?.focus();
    },
    100
  );
}


async function handleSignIn(
  event
) {
  event.preventDefault();


  if (!supabaseClient) {
    return;
  }


  const email =
    $("#authEmail")
      ?.value
      ?.trim();


  const password =
    $("#authPassword")
      ?.value;


  const submitButton =
    $("#authSubmitButton");


  const errorElement =
    $("#authError");


  if (
    !email ||
    !password
  ) {
    return;
  }


  if (submitButton) {
    submitButton.disabled =
      true;

    submitButton.textContent =
      "Signing In…";
  }


  if (errorElement) {
    errorElement.style.display =
      "none";
  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });


    if (error) {
      throw error;
    }


    APP_STATE.session =
      data.session || null;


    APP_STATE.user =
      data.user || null;


    safeDialogClose(
      $("#authDialog")
    );


    await loadAppData();


    renderApp();


    showToast(
      "Marketing Studio connected.",
      "success"
    );

  } catch (error) {

    console.error(
      "Sign-in failed:",
      error
    );


    if (errorElement) {
      errorElement.textContent =
        error?.message ||
        "Unable to sign in.";

      errorElement.style.display =
        "block";
    }

  } finally {

    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        "Sign In";
    }

  }
}


/* =========================================================
   DATABASE NORMALIZATION
   ========================================================= */

function normalizeBrand(
  row
) {
  const voice =
    Array.isArray(
      row.brand_voice
    )
      ? row.brand_voice[0]
      : row.brand_voice;


  const rules =
    Array.isArray(
      row.brand_rules
    )
      ? row.brand_rules
      : [];


  return {
    id:
      row.id,

    slug:
      row.slug,

    name:
      row.official_name,

    shortName:
      row.short_name ||
      row.official_name,

    mark:
      row.mark ||
      "◆",

    website:
      row.domain ||
      "",

    businessType:
      row.business_type ||
      "",

    stage:
      row.business_stage ||
      "",

    stageLabel:
      row.stage_label ||
      row.business_stage ||
      "Brand",

    primaryGoal:
      row.primary_marketing_goal ||
      "",

    campaignPhase:
      row.campaign_phase ||
      "",

    openingDate:
      row.opening_date ||
      null,

    openingDateConfirmed:
      Boolean(
        row.opening_date_confirmed
      ),

    identity: {
      tagline:
        row.tagline ||
        "",

      personality:
        Array.isArray(
          voice?.adjectives
        )
          ? voice.adjectives
          : []
    },

    voice: {
      emotionalAtmosphere:
        voice?.emotional_atmosphere ||
        "",

      writingNotes:
        voice?.writing_notes ||
        "",

      phrasesToUse:
        Array.isArray(
          voice?.phrases_to_use
        )
          ? voice.phrases_to_use
          : [],

      phrasesToAvoid:
        Array.isArray(
          voice?.phrases_to_avoid
        )
          ? voice.phrases_to_avoid
          : [],

      clichesToAvoid:
        Array.isArray(
          voice?.cliches_to_avoid
        )
          ? voice.cliches_to_avoid
          : []
    },

    marketingStrategy:
      [],

    aiRules:
      rules
        .sort(
          (a, b) =>
            Number(
              a.priority || 100
            ) -
            Number(
              b.priority || 100
            )
        )
        .map(
          rule =>
            rule.rule_text
        )
        .filter(Boolean),

    facts:
      Array.isArray(
        row.brand_facts
      )
        ? row.brand_facts
        : [],

    milestones:
      Array.isArray(
        row.milestones
      )
        ? row.milestones
        : []
  };
}


function normalizeCampaign(
  row
) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    name:
      row.name,

    status:
      row.status,

    objective:
      row.objective,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function normalizeContent(
  row
) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    campaignId:
      row.campaign_id,

    type:
      DB_TYPE_TO_APP_TYPE[
        row.content_type
      ] ||
      "social-post",

    status:
      row.status,

    title:
      row.title,

    body:
      row.body,

    goal:
      row.goal,

    originalRequest:
      row.original_request,

    aiMode:
      row.ai_mode,

    aiBrief:
      row.ai_brief,

    publishAt:
      row.scheduled_for,

    publishedAt:
      row.published_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function normalizeCalendarItem(
  row
) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    title:
      row.title,

    itemType:
      row.item_type,

    startAt:
      row.start_at,

    endAt:
      row.end_at,

    publishAt:
      row.start_at,

    createdAt:
      row.created_at
  };
}


function normalizeAsset(
  row
) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    name:
      row.name,

    category:
      row.category,

    storagePath:
      row.storage_path,

    createdAt:
      row.created_at
  };
}


/* =========================================================
   DATABASE LOAD
   ========================================================= */

async function loadAppData() {
  if (
    !supabaseClient ||
    !APP_STATE.user
  ) {
    return;
  }


  APP_STATE.loading =
    true;


  try {

    const [
      brandsResult,
      campaignsResult,
      contentResult,
      calendarResult,
      assetsResult
    ] =
      await Promise.all([

        supabaseClient
          .from("brands")
          .select(`
            *,
            brand_voice (*),
            brand_rules (*),
            brand_facts (*),
            milestones (*)
          `)
          .order(
            "created_at",
            {
              ascending:
                true
            }
          ),


        supabaseClient
          .from("campaigns")
          .select("*")
          .order(
            "created_at",
            {
              ascending:
                false
            }
          ),


        supabaseClient
          .from("content_items")
          .select("*")
          .order(
            "created_at",
            {
              ascending:
                false
            }
          ),


        supabaseClient
          .from("calendar_items")
          .select("*")
          .order(
            "start_at",
            {
              ascending:
                true
            }
          ),


        supabaseClient
          .from("assets")
          .select("*")
          .order(
            "created_at",
            {
              ascending:
                false
            }
          )

      ]);


    const results = [
      ["brands", brandsResult],
      ["campaigns", campaignsResult],
      ["content", contentResult],
      ["calendar", calendarResult],
      ["assets", assetsResult]
    ];


    for (
      const [
        label,
        result
      ] of results
    ) {
      if (result.error) {
        throw new Error(
          `${label}: ${result.error.message}`
        );
      }
    }


    APP_DATA.brands =
      (
        brandsResult.data ||
        []
      ).map(
        normalizeBrand
      );


    APP_DATA.campaigns =
      (
        campaignsResult.data ||
        []
      ).map(
        normalizeCampaign
      );


    APP_DATA.content =
      (
        contentResult.data ||
        []
      ).map(
        normalizeContent
      );


    APP_DATA.calendar =
      (
        calendarResult.data ||
        []
      ).map(
        normalizeCalendarItem
      );


    APP_DATA.assets =
      (
        assetsResult.data ||
        []
      ).map(
        normalizeAsset
      );


    ensureValidActiveBrand();

  } finally {

    APP_STATE.loading =
      false;

  }
}


/* =========================================================
   ACTIVE BRAND
   ========================================================= */

function getBrandById(
  brandId
) {
  return APP_DATA.brands.find(
    brand =>
      brand.id === brandId
  ) ?? null;
}


function getActiveBrand() {
  return getBrandById(
    APP_STATE.activeBrandId
  );
}


function ensureValidActiveBrand() {
  const activeBrand =
    getActiveBrand();


  if (activeBrand) {
    return activeBrand;
  }


  const fallback =
    APP_DATA.brands[0] ??
    null;


  APP_STATE.activeBrandId =
    fallback?.id ??
    null;


  if (fallback) {
    writeStorage(
      STORAGE_KEYS.activeBrand,
      fallback.id
    );
  }


  return fallback;
}


function setActiveBrand(
  brandId,
  options = {}
) {
  const brand =
    getBrandById(
      brandId
    );


  if (!brand) {
    showToast(
      "That brand could not be found.",
      "error"
    );

    return;
  }


  const changed =
    APP_STATE.activeBrandId !==
    brand.id;


  APP_STATE.activeBrandId =
    brand.id;


  writeStorage(
    STORAGE_KEYS.activeBrand,
    brand.id
  );


  renderActiveBrand();
  renderBrandPicker();
  renderBrandGrid();
  renderDashboard();
  renderCampaigns();
  renderContentLibrary();
  renderAssets();
  syncQuickCreateBrand();


  if (
    changed &&
    options.toast !== false
  ) {
    showToast(
      `Working brand changed to ${brand.shortName}.`,
      "success"
    );
  }
}


/* =========================================================
   ACTIVE BRAND UI
   ========================================================= */

function renderActiveBrand() {
  const brand =
    ensureValidActiveBrand();


  if (!brand) {
    return;
  }


  const elements = [
    [
      "#activeBrandMark",
      brand.mark
    ],

    [
      "#activeBrandName",
      brand.shortName
    ],

    [
      "#activeBrandStage",
      brand.stageLabel
    ],

    [
      "#mobileActiveBrandMark",
      brand.mark
    ],

    [
      "#mobileActiveBrandName",
      brand.shortName
    ],

    [
      "#mobileActiveBrandStage",
      brand.stageLabel
    ]
  ];


  elements.forEach(
    ([
      selector,
      value
    ]) => {

      const element =
        $(selector);


      if (element) {
        element.textContent =
          value || "";
      }

    }
  );
}


/* =========================================================
   BRAND PICKER
   ========================================================= */

function renderBrandPicker() {
  const list =
    $("#brandPickerList");


  if (!list) {
    return;
  }


  if (!APP_DATA.brands.length) {
    list.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◆
        </span>

        <h3>
          No brands found.
        </h3>

        <p>
          No brands are available for this account.
        </p>

      </div>
    `;

    return;
  }


  list.innerHTML =
    APP_DATA.brands
      .map(brand => {

        const isActive =
          brand.id ===
          APP_STATE.activeBrandId;


        return `
          <button
            class="brand-switcher ${
              isActive
                ? "is-selected"
                : ""
            }"
            type="button"
            data-select-brand="${
              escapeHtml(
                brand.id
              )
            }"
          >

            <span
              class="brand-switcher-mark"
              aria-hidden="true"
            >
              ${
                escapeHtml(
                  brand.mark
                )
              }
            </span>

            <span
              class="brand-switcher-copy"
            >

              <strong>
                ${
                  escapeHtml(
                    brand.shortName
                  )
                }
              </strong>

              <small>
                ${
                  escapeHtml(
                    brand.stageLabel
                  )
                }
              </small>

            </span>

            ${
              isActive
                ? `
                  <span
                    aria-label="Current brand"
                  >
                    ✓
                  </span>
                `
                : `
                  <span
                    class="brand-switcher-chevron"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                `
            }

          </button>
        `;

      })
      .join("");
}


/* =========================================================
   BRAND GRID
   ========================================================= */

function renderBrandGrid() {
  const grid =
    $("#brandGrid");


  if (!grid) {
    return;
  }


  if (!APP_DATA.brands.length) {
    grid.innerHTML = `
      <div
        class="empty-state full-width"
      >

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◆
        </span>

        <h3>
          No brands found.
        </h3>

        <p>
          No brands are available for this account.
        </p>

      </div>
    `;

    return;
  }


  grid.innerHTML =
    APP_DATA.brands
      .map(brand => {

        const isActive =
          brand.id ===
          APP_STATE.activeBrandId;


        return `
          <article
            class="content-panel"
            data-brand-card="${
              escapeHtml(
                brand.id
              )
            }"
          >

            <div
              style="
                display:flex;
                align-items:center;
                gap:12px;
                margin-bottom:18px;
              "
            >

              <span
                class="brand-switcher-mark"
                aria-hidden="true"
              >
                ${
                  escapeHtml(
                    brand.mark
                  )
                }
              </span>

              <div
                style="
                  min-width:0;
                  flex:1;
                "
              >

                <span
                  class="eyebrow"
                  style="
                    margin-bottom:4px;
                  "
                >
                  ${
                    escapeHtml(
                      brand.stageLabel
                    )
                  }
                </span>

                <h3
                  style="
                    margin:0;
                    font-family:
                      Georgia,
                      'Times New Roman',
                      serif;
                    font-size:1.15rem;
                    font-weight:400;
                  "
                >
                  ${
                    escapeHtml(
                      brand.shortName
                    )
                  }
                </h3>

              </div>

            </div>

            <p
              style="
                color:var(--muted);
                font-size:.8rem;
                line-height:1.6;
                min-height:62px;
              "
            >
              ${
                escapeHtml(
                  brand.primaryGoal
                )
              }
            </p>

            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin-top:18px;
              "
            >

              ${
                isActive
                  ? `
                    <button
                      class="secondary-button"
                      type="button"
                      disabled
                    >
                      Current Brand
                    </button>
                  `
                  : `
                    <button
                      class="secondary-button"
                      type="button"
                      data-select-brand="${
                        escapeHtml(
                          brand.id
                        )
                      }"
                    >
                      Work With Brand
                    </button>
                  `
              }

              <button
                class="text-button"
                type="button"
                data-open-brand="${
                  escapeHtml(
                    brand.id
                  )
                }"
              >
                Brand Brain
              </button>

            </div>

          </article>
        `;

      })
      .join("");
}


/* =========================================================
   QUICK CREATE BRAND OPTIONS
   ========================================================= */

function renderQuickCreateBrandOptions() {
  const select =
    $("#createBrand");


  if (!select) {
    return;
  }


  if (!APP_DATA.brands.length) {
    select.innerHTML = `
      <option value="">
        No brands connected
      </option>
    `;

    return;
  }


  select.innerHTML =
    APP_DATA.brands
      .map(brand => `
        <option
          value="${
            escapeHtml(
              brand.id
            )
          }"
        >
          ${
            escapeHtml(
              brand.shortName
            )
          }
        </option>
      `)
      .join("");


  syncQuickCreateBrand();
}


function syncQuickCreateBrand() {
  const select =
    $("#createBrand");


  const activeBrand =
    getActiveBrand();


  if (
    !select ||
    !activeBrand
  ) {
    return;
  }


  select.value =
    activeBrand.id;
}


/* =========================================================
   GREETING
   ========================================================= */

function renderGreeting() {
  const heading =
    $("#dashboardGreeting");


  if (!heading) {
    return;
  }


  const hour =
    new Date().getHours();


  let greeting =
    "Good evening.";


  if (
    hour >= 5 &&
    hour < 12
  ) {
    greeting =
      "Good morning.";
  } else if (
    hour >= 12 &&
    hour < 17
  ) {
    greeting =
      "Good afternoon.";
  }


  heading.textContent =
    greeting;
}


/* =========================================================
   BRAND SCOPING
   ========================================================= */

function getBrandScopedItems(
  items,
  brandId
) {
  if (!brandId) {
    return [];
  }


  return items.filter(
    item =>
      item.brandId ===
      brandId
  );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const brand =
    getActiveBrand();


  if (!brand) {
    return;
  }


  const brandContent =
    getBrandScopedItems(
      APP_DATA.content,
      brand.id
    );


  const brandCampaigns =
    getBrandScopedItems(
      APP_DATA.campaigns,
      brand.id
    );


  const scheduledContent =
    brandContent
      .filter(item => {

        if (!item.publishAt) {
          return false;
        }


        const time =
          new Date(
            item.publishAt
          ).getTime();


        return (
          Number.isFinite(time) &&
          time >= Date.now()
        );

      })
      .sort(
        (a, b) =>
          new Date(
            a.publishAt
          ).getTime() -
          new Date(
            b.publishAt
          ).getTime()
      );


  const reviewCount =
    brandContent.filter(
      item =>
        item.status ===
        "review"
    ).length;


  const activeCampaignCount =
    brandCampaigns.filter(
      item =>
        item.status ===
        "active"
    ).length;


  const reviewElement =
    $("#reviewDraftCount");


  const upcomingElement =
    $("#upcomingContentCount");


  const campaignElement =
    $("#activeCampaignCount");


  if (reviewElement) {
    reviewElement.textContent =
      String(reviewCount);
  }


  if (upcomingElement) {
    upcomingElement.textContent =
      String(
        scheduledContent.length
      );
  }


  if (campaignElement) {
    campaignElement.textContent =
      String(
        activeCampaignCount
      );
  }


  renderDashboardUpcoming(
    scheduledContent
  );
}


function renderDashboardUpcoming(
  upcomingItems
) {
  const panel =
    $("#dashboardUpcoming");


  if (!panel) {
    return;
  }


  if (!upcomingItems.length) {
    panel.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◌
        </span>

        <h3>
          Nothing scheduled yet.
        </h3>

        <p>
          Approved content will appear here
          once it has a publishing date.
        </p>

        <button
          class="secondary-button"
          type="button"
          data-open-quick-create
        >
          Create Something
        </button>

      </div>
    `;

    return;
  }


  panel.innerHTML =
    upcomingItems
      .slice(0, 5)
      .map(item => `
        <article>
          <strong>
            ${
              escapeHtml(
                item.title ||
                "Scheduled Content"
              )
            }
          </strong>

          <small>
            ${
              escapeHtml(
                formatDateTime(
                  item.publishAt
                )
              )
            }
          </small>
        </article>
      `)
      .join("");
}


/* =========================================================
   DATE FORMATTING
   ========================================================= */

function formatDateTime(
  value
) {
  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return new Intl.DateTimeFormat(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit"
    }
  ).format(date);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setView(
  viewName,
  options = {}
) {
  if (
    !VALID_VIEWS.has(
      viewName
    )
  ) {
    viewName =
      "dashboard";
  }


  APP_STATE.activeView =
    viewName;


  writeStorage(
    STORAGE_KEYS.lastView,
    viewName
  );


  $$("[data-view-panel]")
    .forEach(panel => {

      const matches =
        panel.dataset.viewPanel ===
        viewName;


      panel.hidden =
        !matches;


      panel.classList.toggle(
        "is-active",
        matches
      );

    });


  $$(
    ".nav-button[data-view], " +
    ".bottom-nav-button[data-view]"
  ).forEach(button => {

    button.classList.toggle(
      "is-active",
      button.dataset.view ===
        viewName
    );

  });


  document.title =
    viewName === "dashboard"
      ? "Black Stag Marketing Studio"
      : `${
          VIEW_TITLES[
            viewName
          ] ||
          "Marketing Studio"
        } | Black Stag`;


  if (
    options.scroll !== false
  ) {
    const main =
      $(".app-main");


    if (main) {
      main.scrollTo({
        top:
          0,

        behavior:
          options.instant
            ? "auto"
            : "smooth"
      });
    }


    window.scrollTo({
      top:
        0,

      behavior:
        options.instant
          ? "auto"
          : "smooth"
    });
  }
}


/* =========================================================
   FILTERS
   ========================================================= */

function setFilterButtons(
  selector,
  dataKey,
  activeValue
) {
  $$(selector)
    .forEach(button => {

      button.classList.toggle(
        "is-active",
        button.dataset[dataKey] ===
          activeValue
      );

    });
}


function setCampaignFilter(
  value
) {
  APP_STATE.campaignFilter =
    value ||
    "all";


  setFilterButtons(
    "[data-campaign-filter]",
    "campaignFilter",
    APP_STATE.campaignFilter
  );


  renderCampaigns();
}


function setContentFilter(
  value
) {
  APP_STATE.contentFilter =
    value ||
    "all";


  setFilterButtons(
    "[data-content-filter]",
    "contentFilter",
    APP_STATE.contentFilter
  );


  renderContentLibrary();
}


function setAssetFilter(
  value
) {
  APP_STATE.assetFilter =
    value ||
    "all";


  setFilterButtons(
    "[data-asset-filter]",
    "assetFilter",
    APP_STATE.assetFilter
  );


  renderAssets();
}


/* =========================================================
   CAMPAIGNS
   ========================================================= */

function renderCampaigns() {
  const list =
    $("#campaignList");


  const brand =
    getActiveBrand();


  if (
    !list ||
    !brand
  ) {
    return;
  }


  let campaigns =
    getBrandScopedItems(
      APP_DATA.campaigns,
      brand.id
    );


  if (
    APP_STATE.campaignFilter !==
    "all"
  ) {
    campaigns =
      campaigns.filter(
        campaign =>
          campaign.status ===
          APP_STATE.campaignFilter
      );
  }


  if (!campaigns.length) {

    const filtered =
      APP_STATE.campaignFilter !==
      "all";


    list.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ✦
        </span>

        <h3>
          ${
            filtered
              ? "Nothing in this category."
              : "No campaigns yet."
          }
        </h3>

        <p>
          ${
            filtered
              ? "Try another campaign filter."
              : "Build your first coordinated marketing campaign for this brand."
          }
        </p>

        ${
          filtered
            ? ""
            : `
              <button
                class="secondary-button"
                type="button"
                data-create-type="campaign"
              >
                Create First Campaign
              </button>
            `
        }

      </div>
    `;

    return;
  }


  list.innerHTML =
    campaigns
      .map(campaign => `
        <article
          class="content-panel"
          style="
            margin-bottom:12px;
          "
        >

          <span class="eyebrow">
            ${
              escapeHtml(
                campaign.status ||
                "draft"
              )
            }
          </span>

          <h3>
            ${
              escapeHtml(
                campaign.name ||
                "Untitled Campaign"
              )
            }
          </h3>

          ${
            campaign.objective
              ? `
                <p
                  style="
                    color:var(--muted);
                    font-size:.8rem;
                    line-height:1.6;
                  "
                >
                  ${
                    escapeHtml(
                      campaign.objective
                    )
                  }
                </p>
              `
              : ""
          }

        </article>
      `)
      .join("");
}


/* =========================================================
   CONTENT LIBRARY
   ========================================================= */

function renderContentLibrary() {
  const library =
    $("#contentLibrary");


  const brand =
    getActiveBrand();


  if (
    !library ||
    !brand
  ) {
    return;
  }


  let content =
    getBrandScopedItems(
      APP_DATA.content,
      brand.id
    );


  if (
    APP_STATE.contentFilter !==
    "all"
  ) {
    content =
      content.filter(
        item =>
          item.status ===
          APP_STATE.contentFilter
      );
  }


  if (!content.length) {

    const filtered =
      APP_STATE.contentFilter !==
      "all";


    library.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◈
        </span>

        <h3>
          ${
            filtered
              ? "Nothing in this category."
              : "No content yet."
          }
        </h3>

        <p>
          ${
            filtered
              ? "Try another content filter."
              : "Create your first piece of content and it will enter the workflow here."
          }
        </p>

      </div>
    `;

    return;
  }


  library.innerHTML =
    content
      .map(item => {

        const typeDefinition =
          CREATE_TYPES[
            item.type
          ];


        return `
          <article
            class="content-panel"
            style="
              margin-bottom:12px;
            "
          >

            <span class="eyebrow">
              ${
                escapeHtml(
                  item.status ||
                  "draft"
                )
              }
            </span>

            <h3
              style="
                margin-bottom:8px;
              "
            >
              ${
                escapeHtml(
                  item.title ||
                  typeDefinition?.label ||
                  "Untitled Content"
                )
              }
            </h3>

            <p
              style="
                color:var(--muted);
                font-size:.8rem;
                line-height:1.6;
                white-space:pre-wrap;
              "
            >
              ${
                escapeHtml(
                  item.body ||
                  ""
                )
              }
            </p>

          </article>
        `;

      })
      .join("");
}


/* =========================================================
   ASSETS
   ========================================================= */

function renderAssets() {
  const grid =
    $("#assetGrid");


  const brand =
    getActiveBrand();


  if (
    !grid ||
    !brand
  ) {
    return;
  }


  let assets =
    getBrandScopedItems(
      APP_DATA.assets,
      brand.id
    );


  if (
    APP_STATE.assetFilter !==
    "all"
  ) {
    assets =
      assets.filter(
        asset =>
          asset.category ===
          APP_STATE.assetFilter
      );
  }


  if (!assets.length) {

    const filtered =
      APP_STATE.assetFilter !==
      "all";


    grid.innerHTML = `
      <div
        class="empty-state full-width"
      >

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ▣
        </span>

        <h3>
          ${
            filtered
              ? "No matching assets."
              : "The vault is empty."
          }
        </h3>

        <p>
          ${
            filtered
              ? "Try another asset category."
              : "Logos, photography, generated artwork, and reusable brand assets will live here."
          }
        </p>

      </div>
    `;

    return;
  }


  grid.innerHTML =
    assets
      .map(asset => `
        <article>
          <strong>
            ${
              escapeHtml(
                asset.name ||
                "Untitled Asset"
              )
            }
          </strong>
        </article>
      `)
      .join("");
}


/* =========================================================
   AI BRIEF GENERATOR
   ========================================================= */

function buildAiBrief({
  brand,
  type,
  goal,
  userPrompt
}) {
  const definition =
    CREATE_TYPES[type] ||
    CREATE_TYPES[
      "social-post"
    ];


  const personality =
    brand.identity
      ?.personality
      ?.length
      ? brand.identity.personality
          .join(", ")
      : "Use the established brand voice.";


  const voiceNotes = [
    brand.voice
      ?.emotionalAtmosphere,

    brand.voice
      ?.writingNotes
  ]
    .filter(Boolean)
    .join("\n");


  const rules =
    brand.aiRules?.length
      ? brand.aiRules
          .map(
            rule =>
              `- ${rule}`
          )
          .join("\n")
      : "- Do not invent business facts.";


  const verifiedFacts =
    brand.facts
      ?.filter(
        fact =>
          fact.status ===
            "verified" ||
          fact.status ===
            "owner_approved"
      )
      .map(
        fact =>
          `- ${
            fact.fact_key ||
            fact.fact_type ||
            "Fact"
          }: ${
            fact.value_text ||
            fact.value ||
            ""
          }`
      )
      .filter(
        line =>
          !line.endsWith(
            ": "
          )
      )
      .join("\n") ||
    "No additional verified facts supplied.";


  const tagline =
    brand.identity?.tagline ||
    "No official tagline supplied.";


  const recentContent =
    getRecentContentForBrief(
      brand.id
    );


  return `BLACK STAG MARKETING STUDIO
AI CONTENT BRIEF

You are helping create marketing content for the following brand.

==================================================
BRAND
==================================================

Official Name:
${brand.name}

Short Name:
${brand.shortName}

Business Type:
${brand.businessType}

Website:
${brand.website || "Not supplied"}

Business Stage:
${brand.stageLabel}

Primary Marketing Goal:
${brand.primaryGoal}

Current Campaign Phase:
${brand.campaignPhase || "Not specified"}

Tagline:
${tagline}


==================================================
BRAND VOICE
==================================================

${personality}

${voiceNotes || ""}


==================================================
VERIFIED BRAND INFORMATION
==================================================

${verifiedFacts}


==================================================
SOURCE-OF-TRUTH RULES
==================================================

${rules}

Treat supplied business information as factual only when it is explicitly included in this brief.

Do not invent:
- prices
- dates
- availability
- operating hours
- promotions
- products
- services
- locations
- policies
- testimonials
- performance claims
- business milestones

If information necessary to complete the request is missing, either write around the missing information or clearly identify what needs confirmation.


==================================================
CONTENT REQUEST
==================================================

Content Type:
${definition.label}

Marketing Goal:
${goal}

Task:
${definition.instruction}

User Request:
${userPrompt}


==================================================
RECENT CONTENT
==================================================

${recentContent}


==================================================
INSTRUCTIONS
==================================================

Create content that sounds specific to this brand rather than generic AI marketing copy.

Preserve the brand's established voice.

Avoid repeating the same hooks, phrases, topics, or calls to action used in recent content.

Do not invent business facts.

Do not turn atmospheric branding into parody.

Keep the writing natural and usable.

When appropriate, give the strongest finished version first.

If useful for this content type, you may also provide:
- a shorter alternate version
- a suggested call to action
- a small number of relevant hashtags
- a visual or photography suggestion

Do not add unnecessary explanations before the finished marketing content.

==================================================
END BRIEF
==================================================`;
}


/* =========================================================
   RECENT CONTENT CONTEXT
   ========================================================= */

function getRecentContentForBrief(
  brandId
) {
  const recent =
    APP_DATA.content
      .filter(
        item =>
          item.brandId ===
          brandId
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt || 0
          ).getTime() -
          new Date(
            a.createdAt || 0
          ).getTime()
      )
      .slice(
        0,
        5
      );


  if (!recent.length) {
    return "No previous content has been saved yet.";
  }


  return recent
    .map(
      (
        item,
        index
      ) => {

        const body =
          String(
            item.body || ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .slice(
              0,
              300
            );


        return `${index + 1}. ${
          item.title ||
          CREATE_TYPES[
            item.type
          ]?.label ||
          "Content"
        }

${body || "No body text."}`;

      }
    )
    .join("\n\n");
}


/* =========================================================
   QUICK CREATE
   ========================================================= */

function openQuickCreate(
  createType =
    "social-post"
) {
  const type =
    CREATE_TYPES[
      createType
    ]
      ? createType
      : "social-post";


  APP_STATE.createType =
    type;


  const definition =
    CREATE_TYPES[type];


  const title =
    $("#quickCreateDialogTitle");


  const hiddenType =
    $("#createContentType");


  const goal =
    $("#createGoal");


  const prompt =
    $("#createPrompt");


  if (title) {
    title.textContent =
      definition.label;
  }


  if (hiddenType) {
    hiddenType.value =
      type;
  }


  if (goal) {
    goal.value =
      definition.defaultGoal;
  }


  syncQuickCreateBrand();


  safeDialogOpen(
    $("#quickCreateDialog")
  );


  window.setTimeout(
    () => {
      prompt?.focus();
    },
    120
  );
}


function closeQuickCreate() {
  safeDialogClose(
    $("#quickCreateDialog")
  );
}


/* =========================================================
   QUICK CREATE SUBMIT
   ========================================================= */

function handleQuickCreateSubmit(
  event
) {
  event.preventDefault();


  const brandId =
    $("#createBrand")
      ?.value;


  const userPrompt =
    $("#createPrompt")
      ?.value
      ?.trim();


  const goal =
    $("#createGoal")
      ?.value ||
    "awareness";


  const type =
    $("#createContentType")
      ?.value ||
    "social-post";


  const brand =
    getBrandById(
      brandId
    );


  if (!brand) {
    showToast(
      "Choose a brand first.",
      "error"
    );

    return;
  }


  if (!userPrompt) {
    showToast(
      "Tell the studio what you want to market.",
      "error"
    );


    $("#createPrompt")
      ?.focus();


    return;
  }


  const brief =
    buildAiBrief({
      brand,
      type,
      goal,
      userPrompt
    });


  APP_STATE.currentAiBrief =
    brief;


  APP_STATE.currentAiRequest = {
    brandId:
      brand.id,

    type,

    goal,

    prompt:
      userPrompt
  };


  closeQuickCreate();


  showAiBriefDialog();
}


/* =========================================================
   AI BRIEF DIALOG
   ========================================================= */

function ensureAiBriefDialog() {
  let dialog =
    $("#aiBriefDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "aiBriefDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div class="dialog-header">

      <div>

        <span class="eyebrow">
          ChatGPT — Manual
        </span>

        <h2>
          AI Brief
        </h2>

      </div>

      <button
        id="closeAiBriefButton"
        class="dialog-close"
        type="button"
        aria-label="Close"
      >
        ×
      </button>

    </div>

    <div class="create-form">

      <p
        style="
          margin:0;
          color:var(--muted);
          font-size:.82rem;
          line-height:1.65;
        "
      >
        Marketing Studio assembled this prompt
        from the active Brand Brain and your
        request. Copy it into ChatGPT, then
        return here with the finished result.
      </p>

      <label class="field">

        <span>
          Generated AI Brief
        </span>

        <textarea
          id="aiBriefText"
          readonly
          style="
            min-height:300px;
          "
        ></textarea>

      </label>

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        "
      >

        <button
          id="copyAiBriefButton"
          class="primary-button"
          type="button"
        >
          Copy Brief
        </button>

        <button
          id="openChatGptButton"
          class="secondary-button"
          type="button"
        >
          Open ChatGPT
        </button>

      </div>

      <button
        id="showPasteResultButton"
        class="secondary-button full-button"
        type="button"
      >
        I Have My Result
      </button>

    </div>
  `;


  document.body.appendChild(
    dialog
  );


  $("#closeAiBriefButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#copyAiBriefButton")
    ?.addEventListener(
      "click",
      copyCurrentAiBrief
    );


  $("#openChatGptButton")
    ?.addEventListener(
      "click",
      openChatGpt
    );


  $("#showPasteResultButton")
    ?.addEventListener(
      "click",
      () => {

        safeDialogClose(
          dialog
        );


        showAiResultDialog();

      }
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


function showAiBriefDialog() {
  const dialog =
    ensureAiBriefDialog();


  const textarea =
    $("#aiBriefText");


  if (textarea) {
    textarea.value =
      APP_STATE.currentAiBrief;
  }


  safeDialogOpen(
    dialog
  );
}


/* =========================================================
   COPY AI BRIEF
   ========================================================= */

async function copyCurrentAiBrief() {
  const brief =
    APP_STATE.currentAiBrief;


  if (!brief) {
    showToast(
      "There is no AI brief to copy.",
      "error"
    );

    return;
  }


  try {

    await navigator.clipboard
      .writeText(
        brief
      );


    showToast(
      "AI brief copied. Paste it into ChatGPT.",
      "success"
    );

  } catch (error) {

    const textarea =
      $("#aiBriefText");


    if (textarea) {
      textarea.focus();
      textarea.select();


      try {

        document.execCommand(
          "copy"
        );


        showToast(
          "AI brief copied. Paste it into ChatGPT.",
          "success"
        );


        return;

      } catch (
        fallbackError
      ) {
        console.warn(
          fallbackError
        );
      }
    }


    showToast(
      "Copy the brief from the text box.",
      "error"
    );

  }
}


/* =========================================================
   OPEN CHATGPT
   ========================================================= */

function openChatGpt() {
  window.open(
    "https://chatgpt.com/",
    "_blank",
    "noopener,noreferrer"
  );
}


/* =========================================================
   AI RESULT DIALOG
   ========================================================= */

function ensureAiResultDialog() {
  let dialog =
    $("#aiResultDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "aiResultDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div class="dialog-header">

      <div>

        <span class="eyebrow">
          Content Workflow
        </span>

        <h2>
          Bring It Back
        </h2>

      </div>

      <button
        id="closeAiResultButton"
        class="dialog-close"
        type="button"
        aria-label="Close"
      >
        ×
      </button>

    </div>

    <form
      id="aiResultForm"
      class="create-form"
    >

      <p
        style="
          margin:0;
          color:var(--muted);
          font-size:.82rem;
          line-height:1.65;
        "
      >
        Paste the finished ChatGPT response
        below. Marketing Studio will save it
        to Supabase as a draft under the
        correct brand.
      </p>

      <label class="field">

        <span>
          Draft Title
        </span>

        <input
          id="aiResultTitle"
          type="text"
          placeholder="Optional title"
          autocomplete="off"
        />

      </label>

      <label class="field">

        <span>
          ChatGPT Result
        </span>

        <textarea
          id="aiResultText"
          placeholder="Paste the finished content here..."
          style="
            min-height:260px;
          "
          required
        ></textarea>

      </label>

      <div class="form-actions">

        <button
          id="backToBriefButton"
          class="secondary-button"
          type="button"
        >
          Back
        </button>

        <button
          id="saveAiDraftButton"
          class="primary-button"
          type="submit"
        >
          Save Draft
        </button>

      </div>

    </form>
  `;


  document.body.appendChild(
    dialog
  );


  $("#closeAiResultButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#backToBriefButton")
    ?.addEventListener(
      "click",
      () => {

        safeDialogClose(
          dialog
        );


        showAiBriefDialog();

      }
    );


  $("#aiResultForm")
    ?.addEventListener(
      "submit",
      handleAiResultSubmit
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


function showAiResultDialog() {
  const dialog =
    ensureAiResultDialog();


  const title =
    $("#aiResultTitle");


  const text =
    $("#aiResultText");


  const definition =
    CREATE_TYPES[
      APP_STATE.currentAiRequest
        .type
    ];


  if (
    title &&
    !title.value
  ) {
    title.value =
      definition?.label ||
      "Marketing Draft";
  }


  safeDialogOpen(
    dialog
  );


  window.setTimeout(
    () => {
      text?.focus();
    },
    100
  );
}


/* =========================================================
   SAVE AI RESULT TO SUPABASE
   ========================================================= */

async function handleAiResultSubmit(
  event
) {
  event.preventDefault();


  const result =
    $("#aiResultText")
      ?.value
      ?.trim();


  const title =
    $("#aiResultTitle")
      ?.value
      ?.trim();


  const saveButton =
    $("#saveAiDraftButton");


  if (!result) {
    showToast(
      "Paste the finished ChatGPT content first.",
      "error"
    );

    return;
  }


  const request =
    APP_STATE.currentAiRequest;


  const brand =
    getBrandById(
      request.brandId
    );


  if (!brand) {
    showToast(
      "The selected brand could not be found.",
      "error"
    );

    return;
  }


  const typeDefinition =
    CREATE_TYPES[
      request.type
    ] ||
    CREATE_TYPES[
      "social-post"
    ];


  if (saveButton) {
    saveButton.disabled =
      true;

    saveButton.textContent =
      "Saving…";
  }


  try {

    const payload = {
      brand_id:
        brand.id,

      campaign_id:
        null,

      content_type:
        typeDefinition.dbType,

      status:
        "draft",

      title:
        title ||
        typeDefinition.label ||
        "Marketing Draft",

      body:
        result,

      goal:
        request.goal,

      original_request:
        request.prompt,

      ai_mode:
        "manual-chatgpt",

      ai_brief:
        APP_STATE.currentAiBrief
    };


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "content_items"
        )
        .insert(
          payload
        )
        .select()
        .single();


    if (error) {
      throw error;
    }


    APP_DATA.content.unshift(
      normalizeContent(
        data
      )
    );


    safeDialogClose(
      $("#aiResultDialog")
    );


    resetAiWorkflow();


    renderDashboard();
    renderContentLibrary();


    setView(
      "studio"
    );


    showToast(
      "Draft saved to Content Studio.",
      "success"
    );

  } catch (error) {

    console.error(
      "Unable to save draft:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save the draft.",
      "error",
      5000
    );

  } finally {

    if (saveButton) {
      saveButton.disabled =
        false;

      saveButton.textContent =
        "Save Draft";
    }

  }
}


/* =========================================================
   RESET AI WORKFLOW
   ========================================================= */

function resetAiWorkflow() {
  APP_STATE.currentAiBrief =
    "";


  APP_STATE.currentAiRequest = {
    brandId:
      null,

    type:
      null,

    goal:
      null,

    prompt:
      null
  };


  const prompt =
    $("#createPrompt");


  const result =
    $("#aiResultText");


  const title =
    $("#aiResultTitle");


  if (prompt) {
    prompt.value =
      "";
  }


  if (result) {
    result.value =
      "";
  }


  if (title) {
    title.value =
      "";
  }
}


/* =========================================================
   BRAND BRAIN
   ========================================================= */

function openBrandBrain(
  brandId
) {
  const brand =
    getBrandById(
      brandId
    );


  if (!brand) {
    return;
  }


  setActiveBrand(
    brand.id,
    {
      toast:
        false
    }
  );


  showToast(
    `${brand.shortName} Brand Brain is connected to Supabase. The editor UI is next.`,
    "success"
  );
}


/* =========================================================
   ADD BRAND
   ========================================================= */

function handleAddBrand() {
  showToast(
    "The database is ready for new brands. The Add Brand editor is coming next.",
    "success"
  );
}


/* =========================================================
   ASSET PLACEHOLDER
   ========================================================= */

function handleAddAsset() {
  showToast(
    "The private Asset Vault is connected. Upload controls are coming next.",
    "success"
  );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function handleSettingsSection(
  section
) {
  if (
    section ===
    "ai"
  ) {
    const mode =
      CONFIG.ai?.mode ||
      "manual-chatgpt";


    const label =
      mode ===
      "manual-chatgpt"
        ? "ChatGPT — Manual"
        : "OpenAI API — Automatic";


    showToast(
      `AI Mode: ${label}`,
      "success"
    );


    return;
  }


  const labels = {
    social:
      "Social account connections",

    publishing:
      "Publishing settings",

    preferences:
      "App preferences"
  };


  showToast(
    `${
      labels[section] ||
      "This settings section"
    } will be connected in the next phase.`,
    "success"
  );
}


/* =========================================================
   TOASTS
   ========================================================= */

function showToast(
  message,
  type = "default",
  duration = 3200
) {
  const region =
    $("#toastRegion");


  if (!region) {
    return;
  }


  const toast =
    document.createElement(
      "div"
    );


  toast.className =
    `toast ${
      type === "success"
        ? "is-success"
        : type === "error"
          ? "is-error"
          : ""
    }`;


  toast.textContent =
    message;


  region.appendChild(
    toast
  );


  window.setTimeout(
    () => {

      toast.style.opacity =
        "0";


      toast.style.transform =
        "translateY(5px)";

    },
    Math.max(
      500,
      duration - 250
    )
  );


  window.setTimeout(
    () => {
      toast.remove();
    },
    duration
  );
}


/* =========================================================
   DIALOG BACKDROP CLOSE
   ========================================================= */

function enableBackdropClose(
  dialog
) {
  if (!dialog) {
    return;
  }


  dialog.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        dialog
      ) {
        safeDialogClose(
          dialog
        );
      }

    }
  );
}


/* =========================================================
   GLOBAL CLICK HANDLER
   ========================================================= */

function handleGlobalClick(
  event
) {
  const viewButton =
    event.target.closest(
      "[data-view]"
    );


  if (viewButton) {
    setView(
      viewButton.dataset.view
    );

    return;
  }


  const createButton =
    event.target.closest(
      "[data-create-type]"
    );


  if (createButton) {
    openQuickCreate(
      createButton.dataset
        .createType
    );

    return;
  }


  const quickCreateButton =
    event.target.closest(
      "[data-open-quick-create]"
    );


  if (quickCreateButton) {
    openQuickCreate(
      "social-post"
    );

    return;
  }


  const selectBrandButton =
    event.target.closest(
      "[data-select-brand]"
    );


  if (selectBrandButton) {
    const brandId =
      selectBrandButton.dataset
        .selectBrand;


    setActiveBrand(
      brandId
    );


    safeDialogClose(
      $("#brandPickerDialog")
    );


    return;
  }


  const openBrandButton =
    event.target.closest(
      "[data-open-brand]"
    );


  if (openBrandButton) {
    openBrandBrain(
      openBrandButton.dataset
        .openBrand
    );

    return;
  }


  const campaignFilterButton =
    event.target.closest(
      "[data-campaign-filter]"
    );


  if (campaignFilterButton) {
    setView(
      "campaigns"
    );


    setCampaignFilter(
      campaignFilterButton.dataset
        .campaignFilter
    );


    return;
  }


  const contentFilterButton =
    event.target.closest(
      "[data-content-filter]"
    );


  if (contentFilterButton) {
    setView(
      "studio"
    );


    setContentFilter(
      contentFilterButton.dataset
        .contentFilter
    );


    return;
  }


  const assetFilterButton =
    event.target.closest(
      "[data-asset-filter]"
    );


  if (assetFilterButton) {
    setAssetFilter(
      assetFilterButton.dataset
        .assetFilter
    );


    return;
  }


  const settingsButton =
    event.target.closest(
      "[data-settings-section]"
    );


  if (settingsButton) {
    handleSettingsSection(
      settingsButton.dataset
        .settingsSection
    );
  }
}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindEvents() {
  document.addEventListener(
    "click",
    handleGlobalClick
  );


  $("#brandSwitcher")
    ?.addEventListener(
      "click",
      () => {

        renderBrandPicker();


        safeDialogOpen(
          $("#brandPickerDialog")
        );

      }
    );


  $("#mobileBrandSwitcher")
    ?.addEventListener(
      "click",
      () => {

        renderBrandPicker();


        safeDialogOpen(
          $("#brandPickerDialog")
        );

      }
    );


  $("#closeBrandPickerButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          $("#brandPickerDialog")
        );
      }
    );


  $("#brandPickerAddButton")
    ?.addEventListener(
      "click",
      () => {

        safeDialogClose(
          $("#brandPickerDialog")
        );


        handleAddBrand();

      }
    );


  $("#addBrandButton")
    ?.addEventListener(
      "click",
      handleAddBrand
    );


  $("#closeQuickCreateButton")
    ?.addEventListener(
      "click",
      closeQuickCreate
    );


  $("#cancelQuickCreateButton")
    ?.addEventListener(
      "click",
      closeQuickCreate
    );


  $("#quickCreateForm")
    ?.addEventListener(
      "submit",
      handleQuickCreateSubmit
    );


  $("#uploadAssetButton")
    ?.addEventListener(
      "click",
      handleAddAsset
    );


  enableBackdropClose(
    $("#brandPickerDialog")
  );


  enableBackdropClose(
    $("#quickCreateDialog")
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key !==
        "Escape"
      ) {
        return;
      }


      safeDialogClose(
        $("#brandPickerDialog")
      );


      safeDialogClose(
        $("#quickCreateDialog")
      );

    }
  );
}


/* =========================================================
   INITIAL RENDER
   ========================================================= */

function renderApp() {
  ensureValidActiveBrand();

  renderGreeting();

  renderActiveBrand();

  renderBrandPicker();

  renderBrandGrid();

  renderQuickCreateBrandOptions();

  renderDashboard();

  renderCampaigns();

  renderContentLibrary();

  renderAssets();


  const initialView =
    VALID_VIEWS.has(
      APP_STATE.activeView
    )
      ? APP_STATE.activeView
      : "dashboard";


  setView(
    initialView,
    {
      scroll:
        false,

      instant:
        true
    }
  );
}


/* =========================================================
   AUTH SESSION
   ========================================================= */

async function getInitialSession() {
  const {
    data,
    error
  } =
    await supabaseClient.auth
      .getSession();


  if (error) {
    throw error;
  }


  APP_STATE.session =
    data.session ||
    null;


  APP_STATE.user =
    data.session?.user ||
    null;


  return APP_STATE.session;
}


/* =========================================================
   BOOT
   ========================================================= */

async function init() {
  bindEvents();


  try {

    createSupabaseClient();


    const session =
      await getInitialSession();


    if (!session) {
      renderGreeting();

      showAuthDialog();

      return;
    }


    await loadAppData();


    renderApp();


    if (!APP_DATA.brands.length) {
      showToast(
        "Connected, but no brands were returned for this account.",
        "error",
        6000
      );
    }

  } catch (error) {

    console.error(
      "Marketing Studio startup failed:",
      error
    );


    renderGreeting();


    showToast(
      error?.message ||
      "Marketing Studio could not connect to Supabase.",
      "error",
      7000
    );

  }
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    {
      once:
        true
    }
  );
} else {
  init();
}