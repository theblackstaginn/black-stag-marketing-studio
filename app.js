/* =========================================================
   BLACK STAG MARKETING STUDIO
   app.js
   AUDITED BUILD

   Supabase-connected application:
   - Authentication
   - Persistent authenticated session
   - Brand loading / switching
   - Brand Brain editor
   - Identity
   - Voice
   - Source of Truth
   - AI Guardrails
   - Milestones
   - Campaigns
   - Content Studio
   - Calendar
   - Asset Vault
   - Manual ChatGPT workflow
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
  return String(value ?? "")
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


function arrayToText(value) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.join(", ");
}


function textToArray(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}


function nullableText(value) {
  const cleaned =
    String(value || "").trim();

  return cleaned || null;
}


function nullableDate(value) {
  const cleaned =
    String(value || "").trim();

  return cleaned || null;
}


function formatDateTime(value) {
  if (!value) {
    return "";
  }

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
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  ).format(date);
}


function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(`${value}T12:00:00`);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(date);
}


function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function titleCaseStatus(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, character =>
      character.toUpperCase()
    );
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
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );


  return supabaseClient;
}


/* =========================================================
   APP DATA
   ========================================================= */

const APP_DATA = {
  brands: [],
  campaigns: [],
  content: [],
  calendar: [],
  assets: [],
  assetFolders: []
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

  currentView:
    readStorage(
      STORAGE_KEYS.lastView,
      "dashboard"
    ),

  activeBrandId:
    readStorage(
      STORAGE_KEYS.activeBrand,
      null
    ),

  user: null,

  session: null,

  loading: true,

  campaignFilter:
    "all",

  contentFilter:
    "all",

  assetFilter:
  "all",

activeAssetFolderId:
  null,

  createType:
    "social-post",

  currentAiBrief:
    "",

  currentAiRequest: {
    brandId: null,
    type: null,
    goal: null,
    prompt: null
  },

  brandBrainBrandId:
    null,

  brandBrainTab:
    "identity"
};


/* =========================================================
   VIEW DEFINITIONS
   ========================================================= */

const VALID_VIEWS =
  new Set([
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


const VIEW_DEFINITIONS = {
  dashboard: {
    label: "Dashboard"
  },

  brands: {
    label: "Brands"
  },

  campaigns: {
    label: "Campaigns"
  },

  studio: {
    label: "Content Studio"
  },

  calendar: {
    label: "Calendar"
  },

  vault: {
    label: "Asset Vault"
  },

  settings: {
    label: "Settings"
  }
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

function normalizeBrand(row) {
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

    ownerId:
      row.owner_id,

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
      "operating",

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

    tagline:
      row.tagline ||
      "",

    shortDescription:
      row.short_description ||
      "",

    longDescription:
      row.long_description ||
      "",

    brandStory:
      row.brand_story ||
      "",

    mission:
      row.mission ||
      "",

    differentiator:
      row.differentiator ||
      "",

    brandPromise:
      row.brand_promise ||
      "",

    openingDate:
      row.opening_date ||
      null,

    openingDateConfirmed:
      Boolean(
        row.opening_date_confirmed
      ),

    active:
      row.active !== false,

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
      id:
        voice?.id ||
        null,

      adjectives:
        Array.isArray(
          voice?.adjectives
        )
          ? voice.adjectives
          : [],

      emotionalAtmosphere:
        voice?.emotional_atmosphere ||
        "",

      formality:
        voice?.formality ||
        "",

      humorStyle:
        voice?.humor_style ||
        "",

      mysteryLevel:
        voice?.mystery_level ||
        "",

      preferredVocabulary:
        Array.isArray(
          voice?.preferred_vocabulary
        )
          ? voice.preferred_vocabulary
          : [],

      avoidVocabulary:
        Array.isArray(
          voice?.avoid_vocabulary
        )
          ? voice.avoid_vocabulary
          : [],

      preferredPhrases:
        Array.isArray(
          voice?.preferred_phrases
        )
          ? voice.preferred_phrases
          : [],

      avoidPhrases:
        Array.isArray(
          voice?.avoid_phrases
        )
          ? voice.avoid_phrases
          : [],

      clichesToAvoid:
        Array.isArray(
          voice?.cliches_to_avoid
        )
          ? voice.cliches_to_avoid
          : [],

      emojiPolicy:
        voice?.emoji_policy ||
        "",

      profanityPolicy:
        voice?.profanity_policy ||
        "",

      capitalizationStyle:
        voice?.capitalization_style ||
        "",

      ctaStyle:
        voice?.cta_style ||
        "",

      writingNotes:
        voice?.writing_notes ||
        "",

      approvedExamples:
        Array.isArray(
          voice?.approved_examples
        )
          ? voice.approved_examples
          : []
    },

    rules:
      rules,

    aiRules:
      rules
        .filter(
          rule =>
            rule.active !== false
        )
        .slice()
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


function normalizeCampaign(row) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    name:
      row.name,

    description:
      row.description ||
      "",

    status:
      row.status,

    objective:
      row.objective ||
      "",

    channels:
      Array.isArray(
        row.channels
      )
        ? row.channels
        : [],

    startsOn:
      row.starts_on ||
      null,

    endsOn:
      row.ends_on ||
      null,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function normalizeContent(row) {
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

    platform:
      row.platform ||
      "",

    originalRequest:
      row.original_request,

    aiMode:
      row.ai_mode,

    aiBrief:
      row.ai_brief,

    scheduledFor:
      row.scheduled_for,

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


function normalizeCalendarItem(row) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    type:
      row.item_type ||
      "calendar",

    itemType:
      row.item_type ||
      "calendar",

    title:
      row.title,

    description:
      row.description ||
      "",

    startsAt:
      row.starts_at,

    endsAt:
      row.ends_at,

    startAt:
      row.starts_at,

    endAt:
      row.ends_at,

    publishAt:
      row.starts_at,

    allDay:
      Boolean(
        row.all_day
      ),

    recurring:
      Boolean(
        row.recurring
      ),

    recurrenceRule:
      row.recurrence_rule ||
      "",

    marketingRelevant:
      Boolean(
        row.marketing_relevant
      ),

    sourceType:
      row.source_type ||
      "",

    confirmed:
      Boolean(
        row.confirmed
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function normalizeAssetFolder(row) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    parentFolderId:
      row.parent_folder_id ||
      null,

    name:
      row.name,

    description:
      row.description ||
      "",

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function normalizeAsset(row) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

    folderId:
      row.folder_id ||
      null,

    name:
      row.name,

    category:
      row.asset_type,

    description:
      row.description ||
      "",

    storageBucket:
      row.storage_bucket ||
      "",

    storagePath:
      row.storage_path,

    externalUrl:
      row.external_url,

    mimeType:
      row.mime_type,

    width:
      row.width,

    height:
      row.height,

    altText:
      row.alt_text,

    tags:
      Array.isArray(
        row.tags
      )
        ? row.tags
        : [],

    approvedForAi:
      Boolean(
        row.approved_for_ai
      ),

    approvedForMarketing:
      Boolean(
        row.approved_for_marketing
      ),

    active:
      row.active !== false,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
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
      assetsResult,
      assetFoldersResult
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
              ascending: true
            }
          ),

        supabaseClient
          .from("campaigns")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          ),

        supabaseClient
          .from("content_items")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          ),

        supabaseClient
          .from("calendar_items")
          .select("*")
          .order(
            "starts_at",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("assets")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          ),

        supabaseClient
          .from("asset_folders")
          .select("*")
          .order(
            "name",
            {
              ascending: true
            }
          )

      ]);

    const results = [
      [
        "brands",
        brandsResult
      ],

      [
        "campaigns",
        campaignsResult
      ],

      [
        "content",
        contentResult
      ],

      [
        "calendar",
        calendarResult
      ],

      [
        "assets",
        assetsResult
      ],

      [
        "asset folders",
        assetFoldersResult
      ]
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

    await hydrateAssetSignedUrls(
      APP_DATA.assets
    );

    APP_DATA.assetFolders =
      (
        assetFoldersResult.data ||
        []
      ).map(
        normalizeAssetFolder
      );

    ensureValidActiveBrand();

  } finally {
    APP_STATE.loading =
      false;
  }
}


/* =========================================================
   RELOAD ONE BRAND
   ========================================================= */

async function reloadBrand(
  brandId
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("brands")
      .select(`
        *,
        brand_voice (*),
        brand_rules (*),
        brand_facts (*),
        milestones (*)
      `)
      .eq(
        "id",
        brandId
      )
      .single();


  if (error) {
    throw error;
  }


  const normalized =
    normalizeBrand(
      data
    );


  const index =
    APP_DATA.brands.findIndex(
      brand =>
        brand.id === brandId
    );


  if (index >= 0) {
    APP_DATA.brands[
      index
    ] =
      normalized;
  } else {
    APP_DATA.brands.push(
      normalized
    );
  }


  return normalized;
}


/* =========================================================
   ACTIVE BRAND
   ========================================================= */

function getBrandById(
  brandId
) {
  return (
    APP_DATA.brands.find(
      brand =>
        brand.id === brandId
    ) ??
    null
  );
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


function syncQuickCreateBrand() {
  const select =
    $("#createBrand");


  if (
    !select ||
    !APP_STATE.activeBrandId
  ) {
    return;
  }


  const optionExists =
    Array.from(
      select.options
    ).some(
      option =>
        option.value ===
        APP_STATE.activeBrandId
    );


  if (optionExists) {
    select.value =
      APP_STATE.activeBrandId;
  }
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


  if (changed) {
    APP_STATE.activeAssetFolderId =
      null;
  }


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
  renderCalendar();
  renderAssets();
  renderQuickCreateBrandOptions();
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
    getActiveBrand();


  const desktopMark =
    $("#activeBrandMark");

  const desktopName =
    $("#activeBrandName");

  const desktopStage =
    $("#activeBrandStage");


  const mobileMark =
    $("#mobileActiveBrandMark");

  const mobileName =
    $("#mobileActiveBrandName");

  const mobileStage =
    $("#mobileActiveBrandStage");


  if (!brand) {
    if (desktopMark) {
      desktopMark.textContent =
        "◆";
    }

    if (desktopName) {
      desktopName.textContent =
        "Choose Brand";
    }

    if (desktopStage) {
      desktopStage.textContent =
        "No active brand";
    }

    if (mobileMark) {
      mobileMark.textContent =
        "◆";
    }

    if (mobileName) {
      mobileName.textContent =
        "Choose Brand";
    }

    if (mobileStage) {
      mobileStage.textContent =
        "No active brand";
    }

    return;
  }


  if (desktopMark) {
    desktopMark.textContent =
      brand.mark;
  }


  if (desktopName) {
    desktopName.textContent =
      brand.shortName;
  }


  if (desktopStage) {
    desktopStage.textContent =
      brand.stageLabel;
  }


  if (mobileMark) {
    mobileMark.textContent =
      brand.mark;
  }


  if (mobileName) {
    mobileName.textContent =
      brand.shortName;
  }


  if (mobileStage) {
    mobileStage.textContent =
      brand.stageLabel;
  }
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
          No brands yet.
        </h3>

        <p>
          Add a brand to begin building its
          marketing brain.
        </p>

      </div>
    `;

    return;
  }


  list.innerHTML =
    APP_DATA.brands
      .filter(
        brand =>
          brand.active !== false
      )
      .map(
        brand => {
          const isActive =
            brand.id ===
            APP_STATE.activeBrandId;


          return `
            <button
              class="brand-picker-option ${
                isActive
                  ? "is-active"
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
                style="
                  min-width:0;
                  flex:1;
                  text-align:left;
                "
              >

                <strong
                  style="
                    display:block;
                    margin-bottom:3px;
                  "
                >
                  ${
                    escapeHtml(
                      brand.shortName
                    )
                  }
                </strong>

                <span
                  style="
                    display:block;
                    color:var(--muted);
                    font-size:.7rem;
                  "
                >
                  ${
                    escapeHtml(
                      brand.stageLabel
                    )
                  }
                </span>

              </span>

              ${
                isActive
                  ? `
                    <span
                      class="eyebrow"
                    >
                      Current
                    </span>
                  `
                  : ""
              }

            </button>
          `;
        }
      )
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
      .map(
        brand => {
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
        }
      )
      .join("");
}



/* =========================================================
   TEMPORARY APPROVED BRAND BRAIN IMPORTER
   ========================================================= */

const APPROVED_BRAND_BRAIN_IMPORTS = {
  "stag-and-stone": {
    names: ["Stag & Stone Coffee and Bakehouse","Stag & Stone"],
    identity: {
      domain: "stagandstonecoffee.com",
      business_type: "Coffee shop and bakehouse with mobile event services",
      business_stage: "pre_opening",
      stage_label: "Pre-Opening",
      tagline: "Crafted for the morning ritual.",
      short_description: "A takeaway-first Appalachian coffee and bakehouse in Clarkesville, Georgia, with elevated coffee, breakfast, lunch, breads, pastries, and mobile event services.",
      primary_marketing_goal: "Build awareness for the Clarkesville opening, establish the Stag & Stone brand, and grow cafe, bakehouse, and event-service demand."
    },
    voice: {
      adjectives: ["warm","grounded","atmospheric","handcrafted","Appalachian","welcoming","subtly mysterious"],
      emotional_atmosphere: "Warm Appalachian hospitality with an old-world, handcrafted, earthy atmosphere and understated folklore.",
      formality: "Conversational, polished, and grounded.",
      humor_style: "Occasional dry wit; never forced.",
      mystery_level: "Subtle and atmospheric, never cryptic or Halloween-like.",
      preferred_vocabulary: ["morning","ritual","stone","wood","hearth","mountain","forest","smoke","crafted","bakehouse"],
      avoid_vocabulary: ["spooky","haunted","witchy","hillbilly","corporate"],
      preferred_phrases: ["Crafted for the morning ritual."],
      avoid_phrases: ["best coffee ever","guaranteed","farm-to-table"],
      cliches_to_avoid: ["Southern charm","spooky season","something for everyone"],
      emoji_policy: "Rare; use only when a specific social post benefits from one.",
      profanity_policy: "Avoid in normal public-facing brand copy.",
      capitalization_style: "Natural title and sentence case.",
      cta_style: "Warm, direct invitation.",
      writing_notes: "Use sensory Appalachian imagery without caricature. Food copy should remain clear and appetizing. Folklore and ritual may add atmosphere, but should never overwhelm practical information or become Halloween-themed.",
      approved_examples: ["Crafted for the morning ritual."]
    },
    facts: [
      ["identity","location","Location","Clarkesville, Georgia"],
      ["identity","business_status","Business status","Pre-opening / development"],
      ["identity","business_model","Business model","Takeaway-first Appalachian coffee shop and bakehouse with some dine-in seating and mobile event services."],
      ["hours","planned_hours","Planned cafe hours","Tuesday through Sunday, 7:00 AM-3:00 PM; closed Monday. These hours are planned until opening."],
      ["menu","coffee_program","Coffee program","Coffee, espresso, hot and cold coffee, hot teas, house drinks, and botanical/apothecary-inspired refreshments."],
      ["menu","food_program","Food program","Breakfast, lunch, fresh breads and pastries, daily biscuits, rotating cakes and pastries, sides, and add-ons."],
      ["menu","menu_architecture","Menu architecture","Breakfast & Bakehouse; Lunch; House Drinks & Apothecary; Sides & Add-Ons."],
      ["bakehouse","custom_bakes","Custom bakes","Lynn's Custom Bakes provides custom cakes and pastries as a distinct offering from everyday pastry-case availability."],
      ["drink","the_tall_man","The Tall Man","Signature drink under development: an iced latte with espresso, dark maple, vanilla, and an extremely subtle smoked sea salt note."],
      ["services","coffee_cart","Coffee Cart","Stag & Stone Coffee Cart can serve markets, festivals, and private events with coffee and nonalcoholic beverage service."],
      ["services","mobile_tavern","Mobile Tavern","Mobile Tavern is a service-only event offering. The client purchases and transports all alcohol."],
      ["services","mobile_tavern_scope","Mobile Tavern service scope","Stag & Stone may provide the cart, service, bartending-related setup, barware, mixers, garnishes, and atmosphere as applicable, but does not purchase or transport the client's alcohol."],
      ["community","magic_night","Magic: The Gathering night","Planned weekly community programming; not scheduled until a date is confirmed."],
      ["community","dnd_night","Dungeons & Dragons night","Planned community programming; not scheduled until a date is confirmed."],
      ["community","book_club","Monthly book club","Planned monthly book club hosted by Jess; not scheduled until a date is confirmed."],
      ["brand","aesthetic","Brand aesthetic","Appalachian, old-world, handcrafted, earthy, warm, atmospheric, and subtly folkloric; not Halloween-themed."]
    ],
    rules: [
      ["factual",10,"Never claim Stag & Stone is open until its business status is explicitly changed."],
      ["factual",11,"Never invent an opening date."],
      ["factual",12,"Never convert planned hours into confirmed operating hours."],
      ["pricing",20,"Never invent menu prices, specials, or availability."],
      ["factual",21,"Never invent ingredients or dietary/allergen claims."],
      ["factual",22,"Never call an ingredient or product house-made unless that claim is confirmed."],
      ["factual",23,"Never invent sourcing claims such as local, organic, fair-trade, or farm-to-table."],
      ["factual",24,"Never invent awards, reviews, or customer testimonials."],
      ["promotion",30,"Never advertise planned community events as scheduled until dates are confirmed."],
      ["factual",31,"Never invent event dates."],
      ["factual",40,"Never imply Stag & Stone purchases, transports, sells, or furnishes alcohol through Mobile Tavern."],
      ["factual",41,"When relevant, state clearly that Mobile Tavern clients purchase and transport their own alcohol."],
      ["factual",42,"Do not make legal or alcohol-compliance guarantees."],
      ["factual",50,"Keep Lynn's custom-order work distinct from everyday pastry-case availability."],
      ["factual",51,"Treat The Tall Man as a drink under development until its final menu status is confirmed."],
      ["voice",60,"Do not caricature Appalachian culture or use fake Southern/Appalachian dialect."],
      ["voice",61,"Do not turn the brand into Halloween or overuse occult and witch terminology."],
      ["factual",62,"Do not fabricate folklore and present it as authentic Appalachian history."],
      ["approval",5,"Prefer confirmed Source of Truth facts over assumptions. If a needed fact is missing, do not invent it."]
    ],
    milestones: [
      ["Stag & Stone concept established","completed","Core cafe and bakehouse concept established."],
      ["Brand identity established","completed","Stag & Stone brand identity and direction established."],
      ["Domain established","completed","stagandstonecoffee.com established."],
      ["Website developed","completed","Stag & Stone website developed."],
      ["Menu architecture developed","completed","Primary menu sections and presentation structure established."],
      ["Bakehouse concept established","completed","Bakehouse and custom-bake direction established."],
      ["Lynn's Custom Bakes integrated","completed","Custom cakes and pastries incorporated into the Stag & Stone concept."],
      ["Coffee Cart developed","completed","Mobile Coffee Cart service developed."],
      ["Mobile Tavern concept established","completed","Service-only Mobile Tavern offering established."],
      ["Signature drink development begun","in_progress","The Tall Man signature drink is in development."],
      ["Community programming concept established","completed","Magic, D&D, and monthly book-club concepts established."],
      ["Clarkesville cafe development underway","in_progress","Physical cafe planning and development are underway."],
      ["Opening","planned","Future opening milestone; no opening date is confirmed."]
    ]
  },

  "lace-and-leather-arcane": {
    names: ["Lace & Leather Arcane","Lace and Leather Arcane"],
    identity: {
      business_type: "Digital fantasy artwork, textures, and custom fantasy maps",
      short_description: "Dark, tactile, handcrafted digital textures and custom fantasy maps with an intentional arcane aesthetic.",
      primary_marketing_goal: "Showcase digital texture products and custom fantasy-map commissions while preserving a distinctive handcrafted arcane identity."
    },
    voice: {
      adjectives: ["dark","elegant","arcane","artistic","textural","mysterious","handcrafted"],
      emotional_atmosphere: "Dark, tactile, elegant, and arcane with believable physical character.",
      formality: "Artful but clear.",
      humor_style: "Minimal; atmosphere comes first.",
      mystery_level: "High enough to feel arcane, never so high that product information becomes unclear.",
      preferred_vocabulary: ["arcane","texture","crafted","aged","map","parchment","tactile","weathered"],
      avoid_vocabulary: ["spooky","Halloween","generic goth"],
      preferred_phrases: ["No stock-photo noise, no fake grunge."],
      avoid_phrases: ["spooky season","goth aesthetic"],
      cliches_to_avoid: ["dark and mysterious","perfect for every adventurer"],
      emoji_policy: "Rare.",
      profanity_policy: "Avoid in standard product copy.",
      capitalization_style: "Natural title and sentence case.",
      cta_style: "Clear invitation with an artistic edge.",
      writing_notes: "Fantasy language may add atmosphere, but product descriptions must clearly explain what the customer receives. Emphasize intentional texture and believable physical character rather than generic digital effects.",
      approved_examples: ["No stock-photo noise, no fake grunge."]
    },
    facts: [
      ["identity","core_offerings","Core offerings","Digital textures and custom fantasy maps."],
      ["pricing","texture_pack_price","Texture-pack price","Established texture-pack price: $5."],
      ["commissions","map_commissions","Custom map commissions","Custom fantasy-map commissions are offered."],
      ["commissions","monthly_capacity","Monthly commission capacity","Maximum established capacity is three custom commission slots per month."],
      ["products","offering_distinction","Offering distinction","Digital products and custom commissions are distinct offerings."],
      ["brand","creative_principle","Creative principle","No stock-photo noise, no fake grunge."],
      ["brand","aesthetic","Brand aesthetic","Dark, tactile, handcrafted, arcane, aged, atmospheric, and intentional rather than generic Halloween or goth styling."]
    ],
    rules: [
      ["factual",10,"Never invent products or product specifications."],
      ["factual",11,"Never invent commission availability."],
      ["factual",12,"Never advertise more than three custom commission slots per month without explicit approval."],
      ["factual",20,"Never invent previous clients, testimonials, or commission examples."],
      ["factual",21,"Never invent licensing terms, commercial-use rights, turnaround times, file formats, or resolutions."],
      ["factual",22,"Never describe work as hand-painted or hand-drawn unless that process is confirmed."],
      ["visual",30,"Do not introduce generic stock-photo noise or fake-grunge styling as part of the brand aesthetic."],
      ["voice",31,"Do not reduce the brand aesthetic to generic goth."],
      ["voice",32,"Do not turn Lace & Leather Arcane into Halloween merchandise."],
      ["content",40,"Product descriptions must distinguish atmospheric language from factual product specifications."],
      ["approval",5,"If product availability or specifications are not confirmed, do not invent them."]
    ],
    milestones: [
      ["Lace & Leather Arcane established","completed","Brand established."],
      ["Arcane visual identity established","completed","Dark, tactile, handcrafted visual direction established."],
      ["Digital texture offering established","completed","Digital texture products established."],
      ["$5 texture-pack pricing established","completed","Texture-pack price established at $5."],
      ["Custom fantasy-map commissions established","completed","Custom fantasy-map commission offering established."],
      ["Three-slot monthly commission model established","completed","Maximum monthly custom commission capacity established at three slots."]
    ]
  },

  "black-stag-web-design": {
    names: ["Black Stag Web Design"],
    identity: {
      domain: "blackstagweb.com",
      business_type: "Independent small-business web design and development",
      short_description: "North Georgia web design for small businesses: custom-coded, mobile-first websites built around practical customer actions and client ownership.",
      primary_marketing_goal: "Win North Georgia small-business web projects by emphasizing practical custom development, mobile usability, transparent pricing, and client ownership."
    },
    voice: {
      adjectives: ["straightforward","independent","approachable","competent","practical","craftsman-like"],
      emotional_atmosphere: "Confident, practical, independent, and approachable.",
      formality: "Plain English and professional without corporate stiffness.",
      humor_style: "Mild irreverence is fine when appropriate.",
      mystery_level: "None; clarity wins.",
      preferred_vocabulary: ["own","custom-coded","mobile-first","practical","fast","clear","small business"],
      avoid_vocabulary: ["disruptive","synergy","revolutionary","tech-bro"],
      preferred_phrases: ["You own the site."],
      avoid_phrases: ["guaranteed rankings","guaranteed leads"],
      cliches_to_avoid: ["cutting-edge solutions","one-stop shop","digital transformation"],
      emoji_policy: "Rare.",
      profanity_policy: "Avoid in standard client-facing copy.",
      capitalization_style: "Natural title and sentence case.",
      cta_style: "Direct, low-pressure action.",
      writing_notes: "Explain technology in ordinary language. Focus on ownership, usefulness, mobile usability, and clear customer actions. Do not attack competitors simply to make Black Stag look better.",
      approved_examples: ["Custom-coded websites you actually own."]
    },
    facts: [
      ["identity","region","Service region","North Georgia."],
      ["identity","audience","Primary audience","Small and local businesses."],
      ["development","approach","Development approach","Sites are primarily custom-coded with HTML, CSS, and JavaScript and designed mobile-first."],
      ["ownership","client_ownership","Client ownership","After the project is paid, the client owns the site files and controls the domain and hosting."],
      ["ownership","no_required_subscription","No required subscription","No mandatory Black Stag subscription is required to keep ownership of the website."],
      ["pricing","tier_one","Tier One","One-page website; established range $250-$600."],
      ["pricing","tier_two","Tier Two","Up to five pages; established range $800-$1,000."],
      ["pricing","payment_structure","Payment structure","Standard structure is 50% deposit and 50% at launch."],
      ["pricing","post_launch_rate","Post-launch work","Post-launch work is $60 per hour."],
      ["portfolio","cavalier_country_farm","Portfolio project","Cavalier Country Farm is an established completed/launched portfolio project."],
      ["portfolio","stag_and_stone","Portfolio project","Stag & Stone Coffee and Bakehouse is an established portfolio project."],
      ["portfolio","excluded_projects","Excluded portfolio projects","Black Stag Inn and Black Stag BBQ are not current portfolio projects."],
      ["messaging","core_philosophy","Core philosophy","Build practical websites that the business actually owns, without intentional proprietary platform lock-in."]
    ],
    rules: [
      ["factual",10,"Never claim or guarantee Google rankings, leads, sales, conversions, or SEO results."],
      ["factual",11,"Never fabricate traffic numbers, performance metrics, clients, testimonials, or portfolio projects."],
      ["ownership",20,"Never imply a client's website remains Black Stag property after final payment."],
      ["ownership",21,"Never imply clients must pay a recurring Black Stag subscription to keep ownership of their website."],
      ["pricing",30,"Do not automatically describe hosting, domains, or third-party services as free."],
      ["pricing",31,"Keep project-specific estimates separate from general package pricing."],
      ["pricing",32,"Do not silently expand Tier One beyond one page."],
      ["pricing",33,"Do not silently expand Tier Two beyond five pages."],
      ["factual",34,"Do not invent functionality included in either package."],
      ["factual",35,"Do not promise a delivery timeline unless one has been established for that project."],
      ["portfolio",40,"Never use Black Stag Inn or Black Stag BBQ as current portfolio examples."],
      ["factual",41,"Clearly distinguish Black Stag design/development fees from third-party expenses when applicable."],
      ["voice",50,"Explain technical concepts in ordinary language and avoid unnecessary developer jargon."],
      ["voice",51,"Do not attack competitors simply to make Black Stag look better."],
      ["approval",5,"If a project-specific fact is not confirmed, do not invent it."]
    ],
    milestones: [
      ["Black Stag Web Design established","completed","Black Stag Web Design established."],
      ["blackstagweb.com established","completed","Primary website/domain established."],
      ["Package and pricing structure established","completed","Tier One, Tier Two, deposit structure, and post-launch rate established."],
      ["Client-ownership model established","completed","Client ownership and no-required-subscription model established."],
      ["Cavalier Country Farm launched","completed","Cavalier Country Farm completed and launched."],
      ["Stag & Stone Coffee and Bakehouse developed","completed","Stag & Stone website developed."],
      ["Stag & Stone added to current portfolio","completed","Stag & Stone added to the current Black Stag portfolio."]
    ]
  }
};


function getApprovedBrandBrainImport(brand) {
  if (!brand) {
    return null;
  }

  const name =
    String(
      brand.name ||
      brand.shortName ||
      ""
    ).trim().toLowerCase();

  const slug =
    String(
      brand.slug ||
      ""
    ).trim().toLowerCase();

  return (
    Object.entries(
      APPROVED_BRAND_BRAIN_IMPORTS
    ).find(
      ([importKey, config]) =>
        importKey === slug ||
        config.names.some(
          candidate =>
            candidate.toLowerCase() ===
            name
        )
    ) ||
    null
  );
}


function canImportApprovedBrandBrain(brand) {
  return Boolean(
    getApprovedBrandBrainImport(
      brand
    )
  );
}


function mergeUniqueText(existing, incoming) {
  const values = [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(incoming) ? incoming : [])
  ];

  return Array.from(
    new Map(
      values
        .filter(Boolean)
        .map(
          value => [
            String(value).trim().toLowerCase(),
            String(value).trim()
          ]
        )
    ).values()
  );
}


function ensureApprovedBrainImportButton() {
  const brand =
    getBrandBrainBrand();

  const title =
    $("#brandBrainTitle");

  if (
    !brand ||
    !title
  ) {
    return;
  }

  let button =
    $("#approvedBrandBrainImportButton");

  if (!button) {
    button =
      document.createElement(
        "button"
      );

    button.id =
      "approvedBrandBrainImportButton";

    button.className =
      "secondary-button";

    button.type =
      "button";

    button.style.marginTop =
      "10px";

    title.parentElement
      ?.appendChild(
        button
      );
  }

  button.dataset
    .importApprovedBrandBrain =
      brand.id;

  button.textContent =
    "Load Approved Brain";
}


async function importApprovedBrandBrain(brandId) {
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

  const choices = {
    "1": "stag-and-stone",
    "2": "lace-and-leather-arcane",
    "3": "black-stag-web-design"
  };

  const selection =
    window.prompt(
      "Choose the approved Brand Brain to load into \"" +
      brand.name +
      "\":\n\n" +
      "1 — Stag & Stone Coffee and Bakehouse\n" +
      "2 — Lace & Leather Arcane\n" +
      "3 — Black Stag Web Design\n\n" +
      "Enter 1, 2, or 3."
    );

  if (selection === null) {
    return;
  }

  const importKey =
    choices[
      String(selection).trim()
    ];

  const config =
    importKey
      ? APPROVED_BRAND_BRAIN_IMPORTS[
          importKey
        ]
      : null;

  if (!config) {
    showToast(
      "Choose 1, 2, or 3.",
      "error"
    );
    return;
  }

  const selectedName =
    config.names[0];

  const confirmed =
    window.confirm(
      "Load the approved \"" +
      selectedName +
      "\" Brand Brain into \"" +
      brand.name +
      "\"?\n\nThis adds missing approved facts, audience intelligence, decision rules, guardrails, milestones, and voice guidance. Existing records are preserved, and existing identity fields are only filled when blank."
    );

  if (!confirmed) {
    return;
  }

  const button =
    $("#approvedBrandBrainImportButton");

  if (button) {
    button.disabled = true;
    button.textContent = "Loading...";
  }

  try {
    const identityPayload = {};

    const identityMap = {
      domain: brand.website,
      business_type: brand.businessType,
      business_stage: brand.stage,
      stage_label: brand.stageLabel,
      tagline: brand.tagline,
      short_description: brand.shortDescription,
      primary_marketing_goal: brand.primaryGoal
    };

    Object.entries(
      config.identity || {}
    ).forEach(
      ([key, value]) => {
        const current =
          identityMap[key];

        if (
          !String(
            current || ""
          ).trim()
        ) {
          identityPayload[key] =
            value;
        }
      }
    );

    if (
      Object.keys(
        identityPayload
      ).length
    ) {
      const { error } =
        await supabaseClient
          .from("brands")
          .update(
            identityPayload
          )
          .eq(
            "id",
            brand.id
          );

      if (error) {
        throw error;
      }
    }

    const currentVoice =
      brand.voice || {};

    const voicePayload = {
      brand_id: brand.id,
      adjectives: mergeUniqueText(currentVoice.adjectives, config.voice.adjectives),
      emotional_atmosphere: currentVoice.emotionalAtmosphere || config.voice.emotional_atmosphere,
      formality: currentVoice.formality || config.voice.formality,
      humor_style: currentVoice.humorStyle || config.voice.humor_style,
      mystery_level: currentVoice.mysteryLevel || config.voice.mystery_level,
      preferred_vocabulary: mergeUniqueText(currentVoice.preferredVocabulary, config.voice.preferred_vocabulary),
      avoid_vocabulary: mergeUniqueText(currentVoice.avoidVocabulary, config.voice.avoid_vocabulary),
      preferred_phrases: mergeUniqueText(currentVoice.preferredPhrases, config.voice.preferred_phrases),
      avoid_phrases: mergeUniqueText(currentVoice.avoidPhrases, config.voice.avoid_phrases),
      cliches_to_avoid: mergeUniqueText(currentVoice.clichesToAvoid, config.voice.cliches_to_avoid),
      emoji_policy: currentVoice.emojiPolicy || config.voice.emoji_policy,
      profanity_policy: currentVoice.profanityPolicy || config.voice.profanity_policy,
      capitalization_style: currentVoice.capitalizationStyle || config.voice.capitalization_style,
      cta_style: currentVoice.ctaStyle || config.voice.cta_style,
      writing_notes: currentVoice.writingNotes || config.voice.writing_notes,
      approved_examples: mergeUniqueText(currentVoice.approvedExamples, config.voice.approved_examples)
    };

    {
      const { error } =
        await supabaseClient
          .from("brand_voice")
          .upsert(
            voicePayload,
            {
              onConflict:
                "brand_id"
            }
          );

      if (error) {
        throw error;
      }
    }

    const existingFactKeys =
      new Set(
        (brand.facts || [])
          .map(
            fact =>
              String(
                fact.fact_key ||
                ""
              ).trim()
          )
          .filter(Boolean)
      );

    const factRows =
      (config.facts || [])
        .filter(
          row =>
            !existingFactKeys.has(
              "approved_import." +
              importKey +
              "." +
              row[1]
            )
        )
        .map(
          row => ({
            brand_id: brand.id,
            category: row[0],
            fact_key:
              "approved_import." +
              importKey +
              "." +
              row[1],
            subject: row[2],
            value_text: row[3],
            status: "owner_approved",
            source_type: "owner",
            source_note: "Imported from the owner-approved Brand Brain plan.",
            ai_can_modify: false,
            is_sensitive: false,
            active: true
          })
        );

    if (factRows.length) {
      const { error } =
        await supabaseClient
          .from("brand_facts")
          .insert(
            factRows
          );

      if (error) {
        throw error;
      }
    }

    const sharedDecisionRules = [
      ["approval",1,"Decision rule: use confirmed known facts as written; do not embellish them into stronger claims."],
      ["approval",2,"Decision rule: when something is planned, proposed, developmental, or coming soon, preserve that status explicitly in marketing copy."],
      ["approval",3,"Decision rule: when a needed fact is unknown, do not fill the blank with an assumption; flag it for owner confirmation."],
      ["approval",4,"Decision rule: if information may have changed since it was recorded, treat it as needing confirmation before publishing."],
      ["approval",6,"Decision rule: a marketing idea, brainstorm, concept, or suggestion is not a business fact unless the owner approves it as one."]
    ];

    const expandedFactsByBrain = {
      "stag-and-stone": [
        ["architecture","parent_brand","Brand hierarchy","Stag & Stone is the parent brand. The Coffee & Bakehouse is the physical cafe; Lynn's Custom Bakes is the custom-bake offering; Coffee Cart is mobile coffee/nonalcoholic service; Mobile Tavern is the service-only event bar offering."],
        ["content","content_pillars","Content pillars","Food & drink; morning ritual; Appalachian atmosphere; people and process; community; events; bakehouse; behind-the-scenes business building; opening journey."],
        ["audience","morning_commuters","Audience: morning commuters","People who need a convenient, quality morning coffee or breakfast stop. Emphasize speed, ritual, reliability, portability, and clear ordering information."],
        ["audience","local_regulars","Audience: local regulars","Nearby customers who can make Stag & Stone part of their routine. Emphasize familiarity, quality, community, rotating offerings, and reasons to return."],
        ["audience","families","Audience: families","Local families looking for approachable breakfast, lunch, pastries, and a welcoming stop. Keep practical information clear and avoid making the atmosphere feel exclusive."],
        ["audience","visitors","Audience: visitors and weekend travelers","Visitors exploring Clarkesville and North Georgia who value memorable local food, coffee, atmosphere, and a strong sense of place."],
        ["audience","coffee_people","Audience: coffee-focused customers","Customers who care about coffee quality and preparation. Use specific confirmed drink information rather than generic premium-coffee claims."],
        ["audience","event_clients","Audience: event clients","Hosts and organizers considering Coffee Cart or Mobile Tavern service. Emphasize service scope, atmosphere, logistics, and clear boundaries around alcohol."],
        ["audience","community_nights","Audience: community-night guests","People drawn by Magic: The Gathering, D&D, book club, and other community programming. Planned programming must not be presented as scheduled until dates are confirmed."]
      ],
      "lace-and-leather-arcane": [
        ["products","product_structure","Product structure","A downloadable digital texture product, a texture collection, a custom fantasy-map commission, and a portfolio/showcase piece are distinct content and sales categories."],
        ["content","aesthetic_vocabulary","Aesthetic vocabulary","Useful vocabulary includes parchment, vellum, weathering, ink, leather, age, patina, cartography, relic, archive, manuscript, tactile, and weathered."],
        ["content","fantasy_intensity","Fantasy intensity rule","Atmospheric fantasy language can be strongest in brand storytelling and showcase copy, moderate in product descriptions, and minimal in checkout, download, licensing, delivery, and instruction copy where clarity comes first."],
        ["commissions","capacity_logic","Commission capacity logic","Three custom map slots per month is maximum capacity, not a statement that three slots are currently available."],
        ["products","specification_rule","Product specification rule","Aesthetic descriptions must remain separate from factual specifications such as file type, dimensions, resolution, license, included files, delivery method, and turnaround time."]
      ],
      "black-stag-web-design": [
        ["audience","local_service_businesses","Audience: local service businesses","Owner-operated local businesses that need customers to quickly understand what they do, where they work, and how to contact or hire them."],
        ["audience","restaurants_cafes","Audience: restaurants and cafes","Food and beverage businesses that need strong mobile presentation, menus, hours, location information, and obvious customer actions."],
        ["audience","farms_breeders","Audience: farms and breeders","Small agricultural and breeder businesses that need trustworthy presentation, clear inquiry paths, ownership of their site, and easy-to-understand information."],
        ["audience","independent_retail","Audience: independent retailers","Local retailers that need a focused web presence without unnecessary enterprise complexity."],
        ["audience","website_frustrated","Audience: businesses frustrated with their current website","Owners dealing with outdated design, poor mobile usability, unclear ownership, difficult editing relationships, or excessive platform complexity."],
        ["messaging","sales_philosophy","Sales philosophy","A website is a business asset, not a hostage situation. The client should own the domain and files. Use the simplest technology that solves the problem, make mobile experience a priority, make the next customer action obvious, and do not sell complexity merely because it is possible."],
        ["sales","tier_one_fit","Tier One qualification","Tier One is suited to a focused one-page presence when the business can communicate its essential offer, trust information, and primary customer action on one page."],
        ["sales","tier_two_fit","Tier Two qualification","Tier Two is suited to businesses that genuinely need separate information architecture across as many as five pages. Do not expand scope automatically."],
        ["portfolio","cavalier_work","Cavalier Country Farm portfolio knowledge","Cavalier Country Farm is a completed custom website project and may be discussed as a portfolio example. Do not invent traffic, lead, ranking, or conversion results."],
        ["portfolio","stag_stone_work","Stag & Stone portfolio knowledge","Stag & Stone Coffee and Bakehouse is a custom website project demonstrating a richer multi-page hospitality brand, menu, bakehouse, and mobile-service presentation. Do not invent performance results."]
      ]
    };

    const expandedRuleRows =
      [
        ...sharedDecisionRules,
        ...(
          importKey === "stag-and-stone"
            ? [
                ["content",70,"Keep Stag & Stone, Coffee & Bakehouse, Lynn's Custom Bakes, Coffee Cart, and Mobile Tavern distinct when describing offers; do not merge their scopes."],
                ["content",71,"Use the established content pillars as planning lanes, not as claims that every pillar must appear in every piece of content."],
                ["approval",72,"Claims about current availability, dates, prices, ingredients, sourcing, events, and opening status require confirmed Source of Truth support."]
              ]
            : importKey === "lace-and-leather-arcane"
              ? [
                  ["content",70,"Keep downloadable products, collections, custom commissions, and portfolio/showcase work distinct."],
                  ["content",71,"Use atmospheric fantasy language without sacrificing clarity about what the customer receives."],
                  ["content",72,"Checkout, delivery, download, licensing, and instruction copy should prioritize plain clarity over fantasy-roleplay language."],
                  ["factual",73,"Three monthly commission slots describes maximum capacity only; never translate it into current availability without confirmation."]
                ]
              : [
                  ["sales",70,"Recommend Tier One or Tier Two based on the actual project scope; do not force a prospect into a package that does not fit."],
                  ["sales",71,"When a request exceeds an established package, identify it as additional or custom scope instead of silently promising it."],
                  ["sales",72,"Lead with business usefulness, ownership, mobile usability, and clear customer actions rather than technical complexity."],
                  ["portfolio",73,"Use portfolio projects to describe demonstrated types of work, but never manufacture client outcomes or performance statistics."]
                ]
        )
      ];

    const expandedFactRows =
      (
        expandedFactsByBrain[
          importKey
        ] ||
        []
      )
        .filter(
          row =>
            !existingFactKeys.has(
              "approved_import." +
              importKey +
              ".expanded." +
              row[1]
            )
        )
        .map(
          row => ({
            brand_id: brand.id,
            category: row[0],
            fact_key:
              "approved_import." +
              importKey +
              ".expanded." +
              row[1],
            subject: row[2],
            value_text: row[3],
            status: "owner_approved",
            source_type: "owner",
            source_note: "Imported from the owner-approved expanded Brand Brain plan.",
            ai_can_modify: false,
            is_sensitive: false,
            active: true
          })
        );

    if (expandedFactRows.length) {
      const { error } =
        await supabaseClient
          .from("brand_facts")
          .insert(
            expandedFactRows
          );

      if (error) {
        throw error;
      }
    }

    const existingRules =
      new Set(
        (brand.rules || [])
          .filter(
            rule =>
              rule.active !== false
          )
          .map(
            rule =>
              String(
                rule.rule_text ||
                ""
              ).trim().toLowerCase()
          )
          .filter(Boolean)
      );

    const ruleRows =
      [
        ...(config.rules || []),
        ...expandedRuleRows
      ]
        .filter(
          row =>
            !existingRules.has(
              String(
                row[2]
              ).trim().toLowerCase()
            )
        )
        .map(
          row => ({
            brand_id: brand.id,
            rule_type: row[0],
            priority: row[1],
            rule_text: row[2],
            active: true
          })
        );

    if (ruleRows.length) {
      const { error } =
        await supabaseClient
          .from("brand_rules")
          .insert(
            ruleRows
          );

      if (error) {
        throw error;
      }
    }

    const existingMilestones =
      new Set(
        (brand.milestones || [])
          .map(
            milestone =>
              String(
                milestone.title ||
                ""
              ).trim().toLowerCase()
          )
          .filter(Boolean)
      );

    const milestoneRows =
      (config.milestones || [])
        .filter(
          row =>
            !existingMilestones.has(
              String(
                row[0]
              ).trim().toLowerCase()
            )
        )
        .map(
          row => ({
            brand_id: brand.id,
            title: row[0],
            status: row[1],
            description: row[2],
            completed_at:
              row[1] === "completed"
                ? new Date()
                    .toISOString()
                : null,
            marketing_worthy: false,
            content_created: false
          })
        );

    if (milestoneRows.length) {
      const { error } =
        await supabaseClient
          .from("milestones")
          .insert(
            milestoneRows
          );

      if (error) {
        throw error;
      }
    }

    await reloadBrand(
      brand.id
    );

    renderActiveBrand();
    renderBrandPicker();
    renderBrandGrid();

    if (
      APP_STATE.brandBrainBrandId ===
      brand.id
    ) {
      renderBrandBrainHeader();
      renderBrandBrainContent();
    }

    showToast(
      brand.shortName +
      " Brand Brain loaded.",
      "success",
      5000
    );

  } catch (error) {
    console.error(
      "Approved Brand Brain import failed:",
      error
    );

    showToast(
      error?.message ||
      "Brand Brain import failed.",
      "error",
      6500
    );

  } finally {
    const currentButton =
      $("#approvedBrandBrainImportButton");

    if (currentButton) {
      currentButton.disabled =
        false;
      currentButton.textContent =
        "Load Approved Brain";
    }
  }
}

/* =========================================================
   BRAND BRAIN
   ========================================================= */

function getBrandBrainBrand() {
  return (
    APP_DATA.brands.find(
      brand =>
        brand.id ===
        APP_STATE.brandBrainBrandId
    ) ||
    null
  );
}


/* =========================================================
   BRAND BRAIN DIALOG
   ========================================================= */

function ensureBrandBrainDialog() {
  let dialog =
    $("#brandBrainDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "brandBrainDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div
      style="
        width:min(960px,94vw);
        max-width:100%;
        max-height:90vh;
        overflow-y:auto;
      "
    >

      <div class="dialog-header">

        <div
          style="
            display:flex;
            align-items:center;
            gap:12px;
            min-width:0;
          "
        >

          <span
            id="brandBrainMark"
            class="brand-switcher-mark"
            aria-hidden="true"
          >
            ◆
          </span>

          <div
            style="
              min-width:0;
            "
          >

            <span
              id="brandBrainStage"
              class="eyebrow"
            >
              Brand Brain
            </span>

            <h2
              id="brandBrainTitle"
              style="
                margin-top:4px;
              "
            >
              Brand Brain
            </h2>

          </div>

        </div>


        <button
          id="closeBrandBrainButton"
          class="dialog-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:22px;
        "
        id="brandBrainTabs"
      >

        <button
          class="filter-button is-active"
          type="button"
          data-brain-tab="identity"
        >
          Identity
        </button>

        <button
          class="filter-button"
          type="button"
          data-brain-tab="voice"
        >
          Voice
        </button>

        <button
          class="filter-button"
          type="button"
          data-brain-tab="facts"
                  >
          Source of Truth
        </button>

        <button
          class="filter-button"
          type="button"
          data-brain-tab="rules"
        >
          AI Guardrails
        </button>

        <button
          class="filter-button"
          type="button"
          data-brain-tab="milestones"
        >
          Milestones
        </button>

      </div>


      <div
        id="brandBrainContent"
      ></div>

    </div>
  `;


  document.body.appendChild(
    dialog
  );


  $("#closeBrandBrainButton")
    ?.addEventListener(
      "click",
      closeBrandBrain
    );


  $("#brandBrainTabs")
    ?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-brain-tab]"
          );


        if (!button) {
          return;
        }


        setBrandBrainTab(
          button.dataset.brainTab
        );
      }
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


/* =========================================================
   OPEN BRAND BRAIN
   ========================================================= */

function openBrandBrain(
  brandId
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


  APP_STATE.brandBrainBrandId =
    brand.id;


  APP_STATE.brandBrainTab =
    "identity";


  /*
    Brand Brain always works in the context
    of the brand being edited.
  */

  setActiveBrand(
    brand.id,
    {
      toast: false
    }
  );


  const dialog =
    ensureBrandBrainDialog();


  renderBrandBrainHeader();

  renderBrandBrainTabs();

  renderBrandBrainContent();


  safeDialogOpen(
    dialog
  );
}


/* =========================================================
   BRAND BRAIN HEADER
   ========================================================= */

function renderBrandBrainHeader() {
  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return;
  }


  const mark =
    $("#brandBrainMark");

  const title =
    $("#brandBrainTitle");

  const stage =
    $("#brandBrainStage");


  if (mark) {
    mark.textContent =
      brand.mark ||
      "◆";
  }


  if (title) {
    title.textContent =
      `${brand.shortName} Brand Brain`;
  }


  if (stage) {
    stage.textContent =
      brand.stageLabel ||
      "Brand Brain";
  }

  ensureApprovedBrainImportButton();
}


/* =========================================================
   BRAND BRAIN TAB
   ========================================================= */

function setBrandBrainTab(
  tab
) {
  const allowed =
    new Set([
      "identity",
      "voice",
      "facts",
      "rules",
      "milestones"
    ]);


  APP_STATE.brandBrainTab =
    allowed.has(tab)
      ? tab
      : "identity";


  renderBrandBrainTabs();

  renderBrandBrainContent();
}


/* =========================================================
   BRAND BRAIN TAB UI
   ========================================================= */

function renderBrandBrainTabs() {
  $$(
    "[data-brain-tab]",
    $("#brandBrainDialog") ||
      document
  ).forEach(
    button => {
      button.classList.toggle(
        "is-active",
        button.dataset.brainTab ===
          APP_STATE.brandBrainTab
      );
    }
  );
}


/* =========================================================
   BRAND BRAIN CONTENT ROUTER
   ========================================================= */

function renderBrandBrainContent() {
  const container =
    $("#brandBrainContent");


  const brand =
    getBrandBrainBrand();


  if (
    !container ||
    !brand
  ) {
    return;
  }


  switch (
    APP_STATE.brandBrainTab
  ) {

    case "voice":
      renderBrandVoiceEditor(
        container,
        brand
      );
      break;


    case "facts":
      renderBrandFactsEditor(
        container,
        brand
      );
      break;


    case "rules":
      renderBrandRulesEditor(
        container,
        brand
      );
      break;


    case "milestones":
      renderBrandMilestonesEditor(
        container,
        brand
      );
      break;


    case "identity":
    default:
      renderBrandIdentityEditor(
        container,
        brand
      );
      break;
  }
}


/* =========================================================
   BRAND BRAIN SECTION HEADER
   ========================================================= */

function brandBrainSectionHeader(
  eyebrow,
  title,
  description
) {
  return `
    <div
      style="
        margin-bottom:20px;
      "
    >

      <span class="eyebrow">
        ${escapeHtml(eyebrow)}
      </span>

      <h3
        style="
          margin:
            5px 0 7px;
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          font-size:1.2rem;
          font-weight:400;
        "
      >
        ${escapeHtml(title)}
      </h3>

      ${
        description
          ? `
            <p
              style="
                margin:0;
                max-width:720px;
                color:var(--muted);
                font-size:.78rem;
                line-height:1.65;
              "
            >
              ${escapeHtml(description)}
            </p>
          `
          : ""
      }

    </div>
  `;
}


/* =========================================================
   BRAND BRAIN GRID
   ========================================================= */

function brandBrainGridOpen() {
  return `
    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(
              min(100%,220px),
              1fr
            )
          );
        gap:14px;
      "
    >
  `;
}


/* =========================================================
   BRAND IDENTITY EDITOR
   ========================================================= */

function renderBrandIdentityEditor(
  container,
  brand
) {
  container.innerHTML = `
    ${brandBrainSectionHeader(
      "Brand Brain",
      "Identity",
      "The core facts that define what this brand is, where it is in its lifecycle, and what its marketing should accomplish."
    )}

    <form
      id="brandIdentityForm"
      class="create-form"
    >

      ${brandBrainGridOpen()}

        <label class="field">

          <span>
            Official Name
          </span>

          <input
            id="brandIdentityOfficialName"
            type="text"
            value="${
              escapeHtml(
                brand.name
              )
            }"
            required
          />

        </label>


        <label class="field">

          <span>
            Short Name
          </span>

          <input
            id="brandIdentityShortName"
            type="text"
            value="${
              escapeHtml(
                brand.shortName
              )
            }"
          />

        </label>


        <label class="field">

          <span>
            Brand Mark
          </span>

          <input
            id="brandIdentityMark"
            type="text"
            value="${
              escapeHtml(
                brand.mark
              )
            }"
            maxlength="12"
          />

        </label>


        <label class="field">

          <span>
            Website
          </span>

          <input
            id="brandIdentityDomain"
            type="url"
            value="${
              escapeHtml(
                brand.website
              )
            }"
            placeholder="https://example.com"
          />

        </label>


        <label class="field">

          <span>
            Business Type
          </span>

          <input
            id="brandIdentityBusinessType"
            type="text"
            value="${
              escapeHtml(
                brand.businessType
              )
            }"
            placeholder="Coffee shop, web design studio…"
          />

        </label>


        <label class="field">

          <span>
            Business Stage
          </span>

          <select
            id="brandIdentityStage"
          >

            <option
              value="pre-opening"
              ${
                brand.stage ===
                  "pre-opening"
                  ? "selected"
                  : ""
              }
            >
              Pre-Opening
            </option>

            <option
              value="operating"
              ${
                brand.stage ===
                  "operating"
                  ? "selected"
                  : ""
              }
            >
              Operating
            </option>

            <option
              value="paused"
              ${
                brand.stage ===
                  "paused"
                  ? "selected"
                  : ""
              }
            >
              Paused
            </option>

            <option
              value="seasonal"
              ${
                brand.stage ===
                  "seasonal"
                  ? "selected"
                  : ""
              }
            >
              Seasonal
            </option>

            <option
              value="development"
              ${
                brand.stage ===
                  "development"
                  ? "selected"
                  : ""
              }
            >
              Development
            </option>

          </select>

        </label>


        <label class="field">

          <span>
            Stage Label
          </span>

          <input
            id="brandIdentityStageLabel"
            type="text"
            value="${
              escapeHtml(
                brand.stageLabel
              )
            }"
            placeholder="Coming Soon"
          />

        </label>


        <label class="field">

          <span>
            Campaign Phase
          </span>

          <input
            id="brandIdentityCampaignPhase"
            type="text"
            value="${
              escapeHtml(
                brand.campaignPhase
              )
            }"
            placeholder="Early ramp, launch, evergreen…"
          />

        </label>

      </div>


      <label class="field">

        <span>
          Primary Marketing Goal
        </span>

        <textarea
          id="brandIdentityPrimaryGoal"
          rows="3"
          placeholder="What should marketing accomplish right now?"
        >${
          escapeHtml(
            brand.primaryGoal
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Tagline
        </span>

        <input
          id="brandIdentityTagline"
          type="text"
          value="${
            escapeHtml(
              brand.tagline
            )
          }"
        />

      </label>


      <label class="field">

        <span>
          Short Description
        </span>

        <textarea
          id="brandIdentityShortDescription"
          rows="3"
          placeholder="A concise description of the business."
        >${
          escapeHtml(
            brand.shortDescription
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Long Description
        </span>

        <textarea
          id="brandIdentityLongDescription"
          rows="5"
          placeholder="A fuller description of the brand and what it does."
        >${
          escapeHtml(
            brand.longDescription
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Brand Story
        </span>

        <textarea
          id="brandIdentityStory"
          rows="6"
          placeholder="Where the brand came from and what shaped it."
        >${
          escapeHtml(
            brand.brandStory
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Mission
        </span>

        <textarea
          id="brandIdentityMission"
          rows="4"
          placeholder="What is this brand here to do?"
        >${
          escapeHtml(
            brand.mission
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Differentiator
        </span>

        <textarea
          id="brandIdentityDifferentiator"
          rows="4"
          placeholder="What meaningfully separates this brand from alternatives?"
        >${
          escapeHtml(
            brand.differentiator
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Brand Promise
        </span>

        <textarea
          id="brandIdentityPromise"
          rows="4"
          placeholder="What can customers consistently expect from this brand?"
        >${
          escapeHtml(
            brand.brandPromise
          )
        }</textarea>

      </label>


      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(
                min(100%,220px),
                1fr
              )
            );
          gap:14px;
        "
      >

        <label class="field">

          <span>
            Opening Date
          </span>

          <input
            id="brandIdentityOpeningDate"
            type="date"
            value="${
              escapeHtml(
                brand.openingDate ||
                ""
              )
            }"
          />

        </label>


        <label
          class="field"
          style="
            justify-content:flex-end;
          "
        >

          <span>
            Opening Date Status
          </span>

          <span
            style="
              display:flex;
              align-items:center;
              gap:9px;
              min-height:44px;
            "
          >

            <input
              id="brandIdentityOpeningConfirmed"
              type="checkbox"
              ${
                brand.openingDateConfirmed
                  ? "checked"
                  : ""
              }
              style="
                width:auto;
              "
            />

            <span
              style="
                color:var(--muted);
                font-size:.78rem;
              "
            >
              Date is confirmed
            </span>

          </span>

        </label>

      </div>


      <div
        class="form-actions"
        style="
          position:sticky;
          bottom:0;
          padding-top:16px;
          padding-bottom:2px;
          background:
            linear-gradient(
              180deg,
              transparent,
              rgba(7,8,11,.97) 25%
            );
        "
      >

        <button
          class="secondary-button"
          type="button"
          data-close-brand-brain
        >
          Close
        </button>

        <button
          id="saveBrandIdentityButton"
          class="primary-button"
          type="submit"
        >
          Save Identity
        </button>

      </div>

    </form>
  `;


  $("#brandIdentityForm")
    ?.addEventListener(
      "submit",
      handleBrandIdentitySave
    );
}


/* =========================================================
   SAVE BRAND IDENTITY
   ========================================================= */

async function handleBrandIdentitySave(
  event
) {
  event.preventDefault();


  const brand =
    getBrandBrainBrand();


  if (!brand) {
    showToast(
      "No Brand Brain is currently open.",
      "error"
    );

    return;
  }


  const officialName =
    $("#brandIdentityOfficialName")
      ?.value
      ?.trim();


  if (!officialName) {
    showToast(
      "Official name is required.",
      "error"
    );

    $("#brandIdentityOfficialName")
      ?.focus();

    return;
  }


  const openingDate =
    nullableDate(
      $("#brandIdentityOpeningDate")
        ?.value
    );


  const openingConfirmed =
    Boolean(
      openingDate &&
      $("#brandIdentityOpeningConfirmed")
        ?.checked
    );


  const payload = {
    official_name:
      officialName,

    short_name:
      nullableText(
        $("#brandIdentityShortName")
          ?.value
      ),

    mark:
      nullableText(
        $("#brandIdentityMark")
          ?.value
      ),

    domain:
      nullableText(
        $("#brandIdentityDomain")
          ?.value
      ),

    business_type:
      nullableText(
        $("#brandIdentityBusinessType")
          ?.value
      ),

    business_stage:
      $("#brandIdentityStage")
        ?.value ||
      "operating",

    stage_label:
      nullableText(
        $("#brandIdentityStageLabel")
          ?.value
      ),

    primary_marketing_goal:
      nullableText(
        $("#brandIdentityPrimaryGoal")
          ?.value
      ),

    campaign_phase:
      nullableText(
        $("#brandIdentityCampaignPhase")
          ?.value
      ),

    tagline:
      nullableText(
        $("#brandIdentityTagline")
          ?.value
      ),

    short_description:
      nullableText(
        $("#brandIdentityShortDescription")
          ?.value
      ),

    long_description:
      nullableText(
        $("#brandIdentityLongDescription")
          ?.value
      ),

    brand_story:
      nullableText(
        $("#brandIdentityStory")
          ?.value
      ),

    mission:
      nullableText(
        $("#brandIdentityMission")
          ?.value
      ),

    differentiator:
      nullableText(
        $("#brandIdentityDifferentiator")
          ?.value
      ),

    brand_promise:
      nullableText(
        $("#brandIdentityPromise")
          ?.value
      ),

    opening_date:
      openingDate,

    opening_date_confirmed:
      openingConfirmed
  };


  const button =
    $("#saveBrandIdentityButton");


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }


  try {
    const {
      error
    } =
      await supabaseClient
        .from("brands")
        .update(payload)
        .eq(
          "id",
          brand.id
        );


    if (error) {
      throw error;
    }


    await reloadBrand(
      brand.id
    );


    renderActiveBrand();

    renderBrandPicker();

    renderBrandGrid();

    renderDashboard();

    renderCampaigns();

    renderContentLibrary();

    renderCalendar();

    renderAssets();

    renderQuickCreateBrandOptions();

    syncQuickCreateBrand();

    renderBrandBrainHeader();

    renderBrandBrainContent();


    showToast(
      "Brand identity saved.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to save brand identity:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save brand identity.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveBrandIdentityButton");


    if (currentButton) {
      currentButton.disabled =
        false;

      currentButton.textContent =
        "Save Identity";
    }
  }
}


/* =========================================================
   CLOSE BRAND BRAIN
   ========================================================= */

function closeBrandBrain() {
  safeDialogClose(
    $("#brandBrainDialog")
  );


  APP_STATE.brandBrainBrandId =
    null;


  APP_STATE.brandBrainTab =
    "identity";
}


/* =========================================================
   BRAND VOICE EDITOR
   ========================================================= */

function renderBrandVoiceEditor(
  container,
  brand
) {
  const voice =
    brand.voice || {};


  container.innerHTML = `
    ${brandBrainSectionHeader(
      "Brand Brain",
      "Voice",
      "Teach Marketing Studio how this brand should sound, which language belongs to it, and which habits should stay out of the copy."
    )}

    <form
      id="brandVoiceForm"
      class="create-form"
    >

      ${brandBrainGridOpen()}

        <label class="field">

          <span>
            Voice Adjectives
                      </span>

          <input
            id="brandVoiceAdjectives"
            type="text"
            value="${
              escapeHtml(
                arrayToText(
                  voice.adjectives
                )
              )
            }"
            placeholder="Warm, old-world, grounded, mysterious"
          />

          <small>
            Separate with commas.
          </small>

        </label>


        <label class="field">

          <span>
            Emotional Atmosphere
          </span>

          <input
            id="brandVoiceAtmosphere"
            type="text"
            value="${
              escapeHtml(
                voice.emotionalAtmosphere ||
                ""
              )
            }"
            placeholder="Welcoming, handcrafted, quietly magical"
          />

        </label>


        <label class="field">

          <span>
            Formality
          </span>

          <input
            id="brandVoiceFormality"
            type="text"
            value="${
              escapeHtml(
                voice.formality ||
                ""
              )
            }"
            placeholder="Conversational, polished, informal…"
          />

        </label>


        <label class="field">

          <span>
            Humor Style
          </span>

          <input
            id="brandVoiceHumor"
            type="text"
            value="${
              escapeHtml(
                voice.humorStyle ||
                ""
              )
            }"
            placeholder="Dry, playful, restrained…"
          />

        </label>


        <label class="field">

          <span>
            Mystery Level
          </span>

          <input
            id="brandVoiceMystery"
            type="text"
            value="${
              escapeHtml(
                voice.mysteryLevel ||
                ""
              )
            }"
            placeholder="Subtle, moderate, none…"
          />

        </label>


        <label class="field">

          <span>
            Capitalization Style
          </span>

          <input
            id="brandVoiceCapitalization"
            type="text"
            value="${
              escapeHtml(
                voice.capitalizationStyle ||
                ""
              )
            }"
            placeholder="Standard sentence case"
          />

        </label>

      </div>


      <label class="field">

        <span>
          Preferred Vocabulary
        </span>

        <textarea
          id="brandVoicePreferredVocabulary"
          rows="3"
          placeholder="Words that naturally belong to this brand, separated by commas."
        >${
          escapeHtml(
            arrayToText(
              voice.preferredVocabulary
            )
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Vocabulary to Avoid
        </span>

        <textarea
          id="brandVoiceAvoidVocabulary"
          rows="3"
          placeholder="Words the brand should avoid, separated by commas."
        >${
          escapeHtml(
            arrayToText(
              voice.avoidVocabulary
            )
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Preferred Phrases
        </span>

        <textarea
          id="brandVoicePreferredPhrases"
          rows="3"
          placeholder="Approved recurring phrases, separated by commas."
        >${
          escapeHtml(
            arrayToText(
              voice.preferredPhrases
            )
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Phrases to Avoid
        </span>

        <textarea
          id="brandVoiceAvoidPhrases"
          rows="3"
          placeholder="Phrases that feel wrong for the brand, separated by commas."
        >${
          escapeHtml(
            arrayToText(
              voice.avoidPhrases
            )
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Clichés to Avoid
        </span>

        <textarea
          id="brandVoiceCliches"
          rows="3"
          placeholder="Overused ideas or phrases Marketing Studio should avoid."
        >${
          escapeHtml(
            arrayToText(
              voice.clichesToAvoid
            )
          )
        }</textarea>

      </label>


      ${brandBrainGridOpen()}

        <label class="field">

          <span>
            Emoji Policy
          </span>

          <input
            id="brandVoiceEmojiPolicy"
            type="text"
            value="${
              escapeHtml(
                voice.emojiPolicy ||
                ""
              )
            }"
            placeholder="Rare, none, moderate…"
          />

        </label>


        <label class="field">

          <span>
            Profanity Policy
          </span>

          <input
            id="brandVoiceProfanityPolicy"
            type="text"
            value="${
              escapeHtml(
                voice.profanityPolicy ||
                ""
              )
            }"
            placeholder="None, light when appropriate…"
          />

        </label>


        <label class="field">

          <span>
            CTA Style
          </span>

          <input
            id="brandVoiceCtaStyle"
            type="text"
            value="${
              escapeHtml(
                voice.ctaStyle ||
                ""
              )
            }"
            placeholder="Warm invitation, direct action…"
          />

        </label>

      </div>


      <label class="field">

        <span>
          Writing Notes
        </span>

        <textarea
          id="brandVoiceWritingNotes"
          rows="5"
          placeholder="Anything else the AI should understand about how this brand writes."
        >${
          escapeHtml(
            voice.writingNotes ||
            ""
          )
        }</textarea>

      </label>


      <label class="field">

        <span>
          Approved Examples
        </span>

        <textarea
          id="brandVoiceApprovedExamples"
          rows="8"
          placeholder="Paste examples of language that feels exactly right for this brand.

Separate multiple examples with a line containing only:
---"
        >${
          escapeHtml(
            Array.isArray(
              voice.approvedExamples
            )
              ? voice.approvedExamples
                  .join(
                    "\n---\n"
                  )
              : ""
          )
        }</textarea>

        <small>
          These become examples of on-brand language
          when Marketing Studio builds an AI brief.
        </small>

      </label>


      <div
        class="form-actions"
        style="
          position:sticky;
          bottom:0;
          padding-top:16px;
          padding-bottom:2px;
          background:
            linear-gradient(
              180deg,
              transparent,
              rgba(7,8,11,.97) 25%
            );
        "
      >

        <button
          class="secondary-button"
          type="button"
          data-close-brand-brain
        >
          Close
        </button>

        <button
          id="saveBrandVoiceButton"
          class="primary-button"
          type="submit"
        >
          Save Voice
        </button>

      </div>

    </form>
  `;


  $("#brandVoiceForm")
    ?.addEventListener(
      "submit",
      handleBrandVoiceSave
    );
}


/* =========================================================
   APPROVED EXAMPLES
   ========================================================= */

function parseApprovedExamples(
  value
) {
  return String(
    value || ""
  )
    .split(
      /\n\s*---\s*\n/g
    )
    .map(
      example =>
        example.trim()
    )
    .filter(Boolean);
}


/* =========================================================
   SAVE BRAND VOICE
   ========================================================= */

async function handleBrandVoiceSave(
  event
) {
  event.preventDefault();


  const brand =
    getBrandBrainBrand();


  if (!brand) {
    showToast(
      "No Brand Brain is currently open.",
      "error"
    );

    return;
  }


  const payload = {
    brand_id:
      brand.id,

    adjectives:
      textToArray(
        $("#brandVoiceAdjectives")
          ?.value
      ),

    emotional_atmosphere:
      nullableText(
        $("#brandVoiceAtmosphere")
          ?.value
      ),

    formality:
      nullableText(
        $("#brandVoiceFormality")
          ?.value
      ),

    humor_style:
      nullableText(
        $("#brandVoiceHumor")
          ?.value
      ),

    mystery_level:
      nullableText(
        $("#brandVoiceMystery")
          ?.value
      ),

    preferred_vocabulary:
      textToArray(
        $("#brandVoicePreferredVocabulary")
          ?.value
      ),

    avoid_vocabulary:
      textToArray(
        $("#brandVoiceAvoidVocabulary")
          ?.value
      ),

    preferred_phrases:
      textToArray(
        $("#brandVoicePreferredPhrases")
          ?.value
      ),

    avoid_phrases:
      textToArray(
        $("#brandVoiceAvoidPhrases")
          ?.value
      ),

    cliches_to_avoid:
      textToArray(
        $("#brandVoiceCliches")
          ?.value
      ),

    emoji_policy:
      nullableText(
        $("#brandVoiceEmojiPolicy")
          ?.value
      ),

    profanity_policy:
      nullableText(
        $("#brandVoiceProfanityPolicy")
          ?.value
      ),

    capitalization_style:
      nullableText(
        $("#brandVoiceCapitalization")
          ?.value
      ),

    cta_style:
      nullableText(
        $("#brandVoiceCtaStyle")
          ?.value
      ),

    writing_notes:
      nullableText(
        $("#brandVoiceWritingNotes")
          ?.value
      ),

    approved_examples:
      parseApprovedExamples(
        $("#brandVoiceApprovedExamples")
          ?.value
      )
  };


  const button =
    $("#saveBrandVoiceButton");


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "brand_voice"
        )
        .upsert(
          payload,
          {
            onConflict:
              "brand_id"
          }
        );


    if (error) {
      throw error;
    }


    await reloadBrand(
      brand.id
    );


    renderActiveBrand();

    renderBrandPicker();

    renderBrandGrid();

    renderBrandBrainHeader();

    renderBrandBrainContent();


    showToast(
      "Brand voice saved.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to save brand voice:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save brand voice.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveBrandVoiceButton");


    if (currentButton) {
      currentButton.disabled =
        false;

      currentButton.textContent =
        "Save Voice";
    }
  }
}


/* =========================================================
   SOURCE OF TRUTH
   ========================================================= */

function renderBrandFactsEditor(
  container,
  brand
) {
  const facts =
    Array.isArray(
      brand.facts
    )
      ? brand.facts
          .filter(
            fact =>
              fact.active !== false
          )
          .slice()
          .sort(
            (a, b) =>
              new Date(
                b.updated_at ||
                b.created_at ||
                0
              ) -
              new Date(
                a.updated_at ||
                a.created_at ||
                0
              )
          )
      : [];


  container.innerHTML = `
    ${brandBrainSectionHeader(
      "Source of Truth",
      "Verified Brand Facts",
      "Store the information Marketing Studio is allowed to treat as factual. Every fact can carry a status, source, verification date, sensitivity flag, and AI permission."
    )}

    <div
      style="
        display:flex;
        justify-content:flex-end;
        margin-bottom:16px;
      "
    >

      <button
        class="primary-button"
        type="button"
        data-add-brand-fact
      >
        Add Fact
      </button>

    </div>


    ${
      facts.length
        ? `
          <div
            style="
              display:grid;
              gap:12px;
            "
          >
            ${
              facts
                .map(
                  renderBrandFactCard
                )
                .join("")
            }
          </div>
        `
        : `
          <div class="empty-state">

            <span
              class="empty-state-icon"
              aria-hidden="true"
            >
              ◇
            </span>

            <h3>
              No Source of Truth facts yet.
            </h3>

            <p>
              Add verified business facts, owner-approved
              information, and anything Marketing Studio
              should know without guessing.
            </p>

            <button
              class="secondary-button"
              type="button"
              data-add-brand-fact
            >
              Add First Fact
            </button>

          </div>
        `
    }


    <div
      class="form-actions"
      style="
        margin-top:20px;
      "
    >

      <button
        class="secondary-button"
        type="button"
        data-close-brand-brain
      >
        Close
      </button>

    </div>
  `;
}


/* =========================================================
   SOURCE OF TRUTH CARD
   ========================================================= */

function renderBrandFactCard(
  fact
) {
  let value =
    fact.value_text ||
    "";


  if (
    !value &&
    fact.value_jsonb != null
  ) {
    try {
      value =
        JSON.stringify(
          fact.value_jsonb,
          null,
          2
        );
    } catch {
      value =
        String(
          fact.value_jsonb
        );
    }
  }


  const label =
    fact.subject ||
    fact.fact_key ||
    fact.category ||
    "Brand Fact";


  return `
    <article
      class="content-panel"
      data-brand-fact="${
        escapeHtml(
          fact.id
        )
      }"
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <div
            style="
              display:flex;
              gap:7px;
              flex-wrap:wrap;
              margin-bottom:8px;
            "
          >

            <span class="eyebrow">
              ${
                escapeHtml(
                  titleCaseStatus(
                    fact.category ||
                    "fact"
                  )
                )
              }
            </span>

            <span
              style="
                display:inline-flex;
                align-items:center;
                min-height:22px;
                padding:3px 7px;
                border:1px solid var(--line);
                border-radius:999px;
                color:var(--muted);
                font-size:.62rem;
                letter-spacing:.04em;
                text-transform:uppercase;
              "
            >
              ${
                escapeHtml(
                  titleCaseStatus(
                    fact.status ||
                    "needs_confirmation"
                  )
                )
              }
            </span>

            ${
              fact.is_sensitive
                ? `
                  <span
                    style="
                      display:inline-flex;
                      align-items:center;
                      min-height:22px;
                      padding:3px 7px;
                      border:1px solid var(--line);
                      border-radius:999px;
                      color:var(--muted);
                      font-size:.62rem;
                      letter-spacing:.04em;
                      text-transform:uppercase;
                    "
                  >
                    Sensitive
                  </span>
                `
                : ""
            }

          </div>


          <h3
            style="
              margin:
                0 0 7px;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-size:1rem;
              font-weight:400;
            "
          >
            ${
              escapeHtml(
                label
              )
            }
          </h3>


          <p
            style="
              margin:0;
              color:var(--muted);
              font-size:.76rem;
              line-height:1.6;
              white-space:pre-wrap;
              overflow-wrap:anywhere;
            "
          >${
            escapeHtml(
              value ||
              "No value stored."
            )
          }</p>


          ${
            fact.source_type ||
            fact.source_url ||
            fact.source_note ||
            fact.last_verified_at
              ? `
                <div
                  style="
                    margin-top:12px;
                    color:var(--muted);
                    font-size:.68rem;
                    line-height:1.55;
                  "
                >

                  ${
                    fact.source_type
                      ? `
                        <div>
                          Source type:
                          ${
                            escapeHtml(
                              fact.source_type
                            )
                          }
                        </div>
                      `
                      : ""
                  }

                  ${
                    fact.source_url
                      ? `
                        <div
                          style="
                            overflow-wrap:anywhere;
                          "
                        >
                          Source:
                          ${
                            escapeHtml(
                              fact.source_url
                            )
                          }
                        </div>
                      `
                      : ""
                  }

                  ${
                    fact.source_note
                      ? `
                        <div>
                          ${
                            escapeHtml(
                              fact.source_note
                            )
                          }
                        </div>
                      `
                      : ""
                  }

                  ${
                                      fact.last_verified_at
                      ? `
                        <div>
                          Verified:
                          ${
                            escapeHtml(
                              formatDateTime(
                                fact.last_verified_at
                              )
                            )
                          }
                        </div>
                      `
                      : ""
                  }

                </div>
              `
              : ""
          }


          <div
            style="
              display:flex;
              gap:8px;
              flex-wrap:wrap;
              margin-top:12px;
              color:var(--muted);
              font-size:.66rem;
            "
          >

            <span>
              AI may modify:
              ${
                fact.ai_can_modify
                  ? "Yes"
                  : "No"
              }
            </span>

            ${
              fact.expires_at
                ? `
                  <span>
                    Expires:
                    ${
                      escapeHtml(
                        formatDateTime(
                          fact.expires_at
                        )
                      )
                    }
                  </span>
                `
                : ""
            }

          </div>

        </div>


        <div
          style="
            display:flex;
            gap:7px;
            flex-wrap:wrap;
          "
        >

          <button
            class="text-button"
            type="button"
            data-edit-brand-fact="${
              escapeHtml(
                fact.id
              )
            }"
          >
            Edit
          </button>

          <button
            class="text-button"
            type="button"
            data-archive-brand-fact="${
              escapeHtml(
                fact.id
              )
            }"
          >
            Archive
          </button>

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   GET SOURCE OF TRUTH FACT
   ========================================================= */

function getBrandFactById(
  factId
) {
  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return null;
  }


  return (
    brand.facts.find(
      fact =>
        fact.id === factId
    ) ||
    null
  );
}


/* =========================================================
   SOURCE OF TRUTH DIALOG
   ========================================================= */

function ensureBrandFactDialog() {
  let dialog =
    $("#brandFactDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "brandFactDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div
      style="
        width:min(720px,94vw);
        max-width:100%;
        max-height:90vh;
        overflow-y:auto;
      "
    >

      <div class="dialog-header">

        <div>

          <span class="eyebrow">
            Source of Truth
          </span>

          <h2 id="brandFactDialogTitle">
            Add Fact
          </h2>

        </div>


        <button
          id="closeBrandFactDialogButton"
          class="dialog-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <form
        id="brandFactForm"
        class="create-form"
      >

        <input
          id="brandFactId"
          type="hidden"
        />


        ${brandBrainGridOpen()}

          <label class="field">

            <span>
              Category
            </span>

            <input
              id="brandFactCategory"
              type="text"
              placeholder="pricing, operations, location, product…"
              required
            />

          </label>


          <label class="field">

            <span>
              Fact Key
            </span>

            <input
              id="brandFactKey"
              type="text"
              placeholder="opening_status"
            />

          </label>


          <label class="field">

            <span>
              Subject
            </span>

            <input
              id="brandFactSubject"
              type="text"
              placeholder="Opening Status"
            />

          </label>


          <label class="field">

            <span>
              Status
            </span>

            <select
              id="brandFactStatus"
            >

              <option value="verified">
                Verified
              </option>

              <option value="owner_approved">
                Owner Approved
              </option>

              <option value="needs_confirmation">
                Needs Confirmation
              </option>

              <option value="ai_suggested">
                AI Suggested
              </option>

            </select>

          </label>

        </div>


        <label class="field">

          <span>
            Value
          </span>

          <textarea
            id="brandFactValue"
            rows="5"
            required
            placeholder="The factual information Marketing Studio should remember."
          ></textarea>

        </label>


        ${brandBrainGridOpen()}

          <label class="field">

            <span>
              Source Type
            </span>

            <input
              id="brandFactSourceType"
              type="text"
              placeholder="website, owner, contract, menu…"
            />

          </label>


          <label class="field">

            <span>
              Source URL
            </span>

            <input
              id="brandFactSourceUrl"
              type="url"
              placeholder="https://..."
            />

          </label>

        </div>


        <label class="field">

          <span>
            Source Note
          </span>

          <textarea
            id="brandFactSourceNote"
            rows="3"
            placeholder="Where this came from or why it is trusted."
          ></textarea>

        </label>


        ${brandBrainGridOpen()}

          <label class="field">

            <span>
              Last Verified
            </span>

            <input
              id="brandFactLastVerified"
              type="datetime-local"
            />

          </label>


          <label class="field">

            <span>
              Expires
            </span>

            <input
              id="brandFactExpires"
              type="datetime-local"
            />

          </label>

        </div>


        <div
          style="
            display:grid;
            gap:10px;
          "
        >

          <label
            style="
              display:flex;
              align-items:center;
              gap:9px;
              color:var(--muted);
              font-size:.78rem;
            "
          >

            <input
              id="brandFactAiCanModify"
              type="checkbox"
              style="
                width:auto;
              "
            />

            AI may modify this value
          </label>


          <label
            style="
              display:flex;
              align-items:center;
              gap:9px;
              color:var(--muted);
              font-size:.78rem;
            "
          >

            <input
              id="brandFactSensitive"
              type="checkbox"
              style="
                width:auto;
              "
            />

            Mark as sensitive

          </label>

        </div>


        <div class="form-actions">

          <button
            id="cancelBrandFactButton"
            class="secondary-button"
            type="button"
          >
            Cancel
          </button>

          <button
            id="saveBrandFactButton"
            class="primary-button"
            type="submit"
          >
            Save Fact
          </button>

        </div>

      </form>

    </div>
  `;


  document.body.appendChild(
    dialog
  );


  $("#brandFactForm")
    ?.addEventListener(
      "submit",
      handleBrandFactSave
    );


  $("#closeBrandFactDialogButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#cancelBrandFactButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


/* =========================================================
   DATETIME-LOCAL HELPERS
   ========================================================= */

function toDateTimeLocalValue(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  const pad =
    number =>
      String(number)
        .padStart(
          2,
          "0"
        );


  return (
    `${date.getFullYear()}-` +
    `${pad(
      date.getMonth() + 1
    )}-` +
    `${pad(
      date.getDate()
    )}T` +
    `${pad(
      date.getHours()
    )}:` +
    `${pad(
      date.getMinutes()
    )}`
  );
}


function fromDateTimeLocalValue(
  value
) {
  if (!value) {
    return null;
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date.toISOString();
}


/* =========================================================
   SHOW SOURCE OF TRUTH DIALOG
   ========================================================= */

function showBrandFactDialog(
  factId = null
) {
  const dialog =
    ensureBrandFactDialog();


  const fact =
    factId
      ? getBrandFactById(
          factId
        )
      : null;


  $("#brandFactDialogTitle").textContent =
    fact
      ? "Edit Fact"
      : "Add Fact";


  $("#brandFactId").value =
    fact?.id ||
    "";


  $("#brandFactCategory").value =
    fact?.category ||
    "";


  $("#brandFactKey").value =
    fact?.fact_key ||
    "";


  $("#brandFactSubject").value =
    fact?.subject ||
    "";


  $("#brandFactValue").value =
    fact?.value_text ||
    "";


  $("#brandFactStatus").value =
    fact?.status ||
    "verified";


  $("#brandFactSourceType").value =
    fact?.source_type ||
    "";


  $("#brandFactSourceUrl").value =
    fact?.source_url ||
    "";


  $("#brandFactSourceNote").value =
    fact?.source_note ||
    "";


  $("#brandFactLastVerified").value =
    toDateTimeLocalValue(
      fact?.last_verified_at
    );


  $("#brandFactExpires").value =
    toDateTimeLocalValue(
      fact?.expires_at
    );


  $("#brandFactAiCanModify").checked =
    Boolean(
      fact?.ai_can_modify
    );


  $("#brandFactSensitive").checked =
    Boolean(
      fact?.is_sensitive
    );


  safeDialogOpen(
    dialog
  );


  window.setTimeout(
    () => {
      $("#brandFactCategory")
        ?.focus();
    },
    100
  );
}


/* =========================================================
   SAVE SOURCE OF TRUTH FACT
   ========================================================= */

async function handleBrandFactSave(
  event
) {
  event.preventDefault();


  const brand =
    getBrandBrainBrand();


  if (!brand) {
    showToast(
      "No Brand Brain is currently open.",
      "error"
    );

    return;
  }


  const factId =
    $("#brandFactId")
      ?.value ||
    null;


  const category =
    $("#brandFactCategory")
      ?.value
      ?.trim();


  const value =
    $("#brandFactValue")
      ?.value
      ?.trim();


  if (
    !category ||
    !value
  ) {
    showToast(
      "Category and value are required.",
      "error"
    );

    return;
  }


  const status =
    $("#brandFactStatus")
      ?.value ||
    "needs_confirmation";


  let lastVerified =
    fromDateTimeLocalValue(
      $("#brandFactLastVerified")
        ?.value
    );


  if (
    status === "verified" &&
    !lastVerified
  ) {
    lastVerified =
      new Date()
        .toISOString();
  }


  const payload = {
    brand_id:
      brand.id,

    category:
      category,

    fact_key:
      nullableText(
        $("#brandFactKey")
          ?.value
      ),

    subject:
      nullableText(
        $("#brandFactSubject")
          ?.value
      ),

    value_text:
      value,

    value_jsonb:
      null,

    status:
      status,

    source_type:
      nullableText(
        $("#brandFactSourceType")
          ?.value
      ),

    source_url:
      nullableText(
        $("#brandFactSourceUrl")
          ?.value
      ),

    source_note:
      nullableText(
        $("#brandFactSourceNote")
          ?.value
      ),

    last_verified_at:
      lastVerified,

    expires_at:
      fromDateTimeLocalValue(
        $("#brandFactExpires")
          ?.value
      ),

    ai_can_modify:
      Boolean(
        $("#brandFactAiCanModify")
          ?.checked
      ),

    is_sensitive:
      Boolean(
        $("#brandFactSensitive")
          ?.checked
      ),

    active:
      true
  };


  const button =
    $("#saveBrandFactButton");


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }


  try {
    let result;


    if (factId) {
      result =
        await supabaseClient
          .from(
            "brand_facts"
          )
          .update(
            payload
          )
          .eq(
            "id",
            factId
          );
    } else {
      result =
        await supabaseClient
          .from(
            "brand_facts"
          )
          .insert(
            payload
          );
    }


    if (result.error) {
      throw result.error;
    }


    await reloadBrand(
      brand.id
    );


    safeDialogClose(
      $("#brandFactDialog")
    );


    renderBrandBrainContent();


    showToast(
      factId
        ? "Source of Truth fact updated."
        : "Source of Truth fact added.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to save Source of Truth fact:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save the fact.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveBrandFactButton");


    if (currentButton) {
      currentButton.disabled =
        false;

      currentButton.textContent =
        "Save Fact";
    }
  }
}


/* =========================================================
   ARCHIVE SOURCE OF TRUTH FACT
   ========================================================= */

async function archiveBrandFact(
  factId
) {
  const brand =
    getBrandBrainBrand();


  const fact =
    getBrandFactById(
      factId
    );


  if (
    !brand ||
    !fact
  ) {
    return;
  }


  const label =
    fact.subject ||
    fact.fact_key ||
    fact.category ||
    "this fact";


  const confirmed =
    window.confirm(
      `Archive "${label}"?`
    );


  if (!confirmed) {
    return;
  }


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "brand_facts"
        )
        .update({
          status:
            "archived",

          active:
            false
        })
                .eq(
          "id",
          fact.id
        );


    if (error) {
      throw error;
    }


    await reloadBrand(
      brand.id
    );


    renderBrandBrainContent();


    showToast(
      "Source of Truth fact archived.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to archive Source of Truth fact:",
      error
    );


    showToast(
      error?.message ||
      "Unable to archive the fact.",
      "error",
      5000
    );
  }
}


/* =========================================================
   SOURCE OF TRUTH ACTIONS
   ========================================================= */

function handleBrandFactsClick(
  event
) {
  const addButton =
    event.target.closest(
      "[data-add-brand-fact]"
    );


  if (addButton) {
    showBrandFactDialog();

    return;
  }


  const editButton =
    event.target.closest(
      "[data-edit-brand-fact]"
    );


  if (editButton) {
    showBrandFactDialog(
      editButton.dataset
        .editBrandFact
    );

    return;
  }


  const archiveButton =
    event.target.closest(
      "[data-archive-brand-fact]"
    );


  if (archiveButton) {
    archiveBrandFact(
      archiveButton.dataset
        .archiveBrandFact
    );
  }
}


/* =========================================================
   AI GUARDRAILS
   ========================================================= */

function renderBrandRulesEditor(
  container,
  brand
) {
  const rules =
    Array.isArray(
      brand.rules
    )
      ? brand.rules
          .filter(
            rule =>
              rule.active !== false
          )
          .slice()
          .sort(
            (a, b) =>
              Number(
                a.priority || 100
              ) -
              Number(
                b.priority || 100
              )
          )
      : [];


  container.innerHTML = `
    ${brandBrainSectionHeader(
      "AI Guardrails",
      "The rules the AI must obey",
      "Guardrails control how Marketing Studio handles this brand. Use them for hard boundaries, approval requirements, factual restrictions, tone limits, and anything the AI must never invent."
    )}


    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:14px;
        flex-wrap:wrap;
        margin-bottom:18px;
      "
    >

      <div
        style="
          max-width:620px;
        "
      >

        <p
          style="
            margin:0;
            color:var(--muted);
            font-size:.78rem;
            line-height:1.6;
          "
        >
          Lower priority numbers are treated as more
          important. Hard factual and safety rules should
          normally receive the strongest priority.
        </p>

      </div>


      <button
        class="primary-button"
        id="addBrandRuleButton"
        type="button"
      >
        + Add Guardrail
      </button>

    </div>


    <div
      id="brandRulesList"
    >

      ${
        rules.length
          ? rules
              .map(
                rule =>
                  renderBrandRuleCard(
                    rule
                  )
              )
              .join("")
          : `
            <div class="empty-state">

              <span
                class="empty-state-icon"
                aria-hidden="true"
              >
                ◈
              </span>

              <h3>
                No AI guardrails yet.
              </h3>

              <p>
                Add rules that tell Marketing Studio
                what the AI may do, what it must confirm,
                and what it must never invent.
              </p>

              <button
                class="secondary-button"
                type="button"
                data-add-brand-rule
              >
                Add First Guardrail
              </button>

            </div>
          `
      }

    </div>


    <div
      class="form-actions"
      style="
        position:sticky;
        bottom:0;
        padding-top:14px;
        padding-bottom:2px;
        background:
          linear-gradient(
            180deg,
            transparent,
            rgba(7,8,11,.96) 25%
          );
      "
    >

      <button
        class="secondary-button"
        type="button"
        data-close-brand-brain
      >
        Close
      </button>

    </div>
  `;


  $("#addBrandRuleButton")
    ?.addEventListener(
      "click",
      () => {
        showBrandRuleDialog();
      }
    );
}


/* =========================================================
   AI GUARDRAIL CARD
   ========================================================= */

function renderBrandRuleCard(
  rule
) {
  const priority =
    Number(
      rule.priority || 100
    );


  const ruleType =
    rule.rule_type ||
    "general";


  return `
    <article
      class="content-panel"
      style="
        margin-bottom:12px;
      "
      data-rule-card="${
        escapeHtml(
          rule.id
        )
      }"
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              flex-wrap:wrap;
              margin-bottom:10px;
            "
          >

            <span class="eyebrow">
              ${
                escapeHtml(
                  titleCaseStatus(
                    ruleType
                  )
                )
              }
            </span>

            <span
              style="
                display:inline-flex;
                align-items:center;
                min-height:24px;
                padding:4px 8px;
                border:1px solid var(--line);
                border-radius:999px;
                color:var(--muted);
                font-size:.65rem;
                letter-spacing:.05em;
                text-transform:uppercase;
              "
            >
              Priority
              ${priority}
            </span>

          </div>


          <p
            style="
              margin:0;
              color:var(--ink);
              font-size:.84rem;
              line-height:1.7;
              white-space:pre-wrap;
            "
          >
            ${
              escapeHtml(
                rule.rule_text ||
                ""
              )
            }
          </p>

        </div>


        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >

          <button
            class="secondary-button"
            type="button"
            data-edit-brand-rule="${
              escapeHtml(
                rule.id
              )
            }"
          >
            Edit
          </button>

          <button
            class="text-button"
            type="button"
            data-archive-brand-rule="${
              escapeHtml(
                rule.id
              )
            }"
          >
            Archive
          </button>

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   FIND AI GUARDRAIL
   ========================================================= */

function getBrandRuleById(
  ruleId
) {
  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return null;
  }


  return (
    brand.rules.find(
      rule =>
        rule.id === ruleId
    ) ||
    null
  );
}


/* =========================================================
   AI GUARDRAIL DIALOG
   ========================================================= */

function ensureBrandRuleDialog() {
  let dialog =
    $("#brandRuleDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "brandRuleDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div
      style="
        width:min(680px,92vw);
        max-width:100%;
        max-height:88vh;
        overflow-y:auto;
      "
    >

      <div class="dialog-header">

        <div>

          <span class="eyebrow">
            AI Guardrails
          </span>

          <h2
            id="brandRuleDialogTitle"
          >
            Add Guardrail
          </h2>

        </div>


        <button
          id="closeBrandRuleDialogButton"
          class="dialog-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <form
        id="brandRuleForm"
        class="create-form"
      >

        <input
          id="brandRuleId"
          type="hidden"
        />


        ${brandBrainGridOpen()}

          <label class="field">

            <span>
              Rule Type
            </span>

            <select
              id="brandRuleType"
            >

              <option value="general">
                General
              </option>

              <option value="factual">
                Factual
              </option>

              <option value="voice">
                Voice
              </option>

              <option value="content">
                Content
              </option>

              <option value="approval">
                Approval
              </option>

              <option value="privacy">
                Privacy
              </option>

              <option value="pricing">
                Pricing
              </option>

              <option value="promotion">
                Promotion
              </option>

              <option value="competitor">
                Competitor
              </option>

              <option value="visual">
                Visual
              </option>

              <option value="publishing">
                Publishing
              </option>

            </select>

          </label>


          <label class="field">

            <span>
              Priority
            </span>

            <input
              id="brandRulePriority"
              type="number"
              min="1"
              step="1"
              value="100"
            />

            <small
              style="
                color:var(--muted);
                font-size:.7rem;
                line-height:1.5;
              "
            >
              Lower number = stronger priority.
            </small>

          </label>

        </div>


        <label class="field">

          <span>
            Guardrail
          </span>

          <textarea
            id="brandRuleText"
            style="
              min-height:180px;
            "
            placeholder="Example: Never imply the physical cafe is currently open until the opening milestone has been confirmed."
            required
          ></textarea>

        </label>


        <div
          style="
            padding:16px;
            border:1px solid var(--line);
            border-radius:var(--radius);
            background:rgba(255,255,255,.018);
          "
        >

          <p
            style="
              margin:0;
              color:var(--muted);
              font-size:.76rem;
              line-height:1.6;
            "
          >
            Guardrails should be direct instructions.
            They are not marketing copy. Write them as
            rules the AI can clearly follow.
          </p>

        </div>


        <div class="form-actions">

          <button
            id="cancelBrandRuleButton"
            class="secondary-button"
            type="button"
          >
            Cancel
          </button>

          <button
            id="saveBrandRuleButton"
            class="primary-button"
            type="submit"
          >
            Save Guardrail
          </button>

        </div>

      </form>

    </div>
  `;


  document.body.appendChild(
    dialog
  );


  $("#closeBrandRuleDialogButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#cancelBrandRuleButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#brandRuleForm")
    ?.addEventListener(
      "submit",
      handleBrandRuleSave
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


/* =========================================================
   SHOW AI GUARDRAIL EDITOR
   ========================================================= */

function showBrandRuleDialog(
  ruleId = null
) {
  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return;
  }


  const dialog =
    ensureBrandRuleDialog();


  const rule =
    ruleId
      ? getBrandRuleById(
          ruleId
        )
      : null;


  const title =
    $("#brandRuleDialogTitle");


  if (title) {
    title.textContent =
      rule
        ? "Edit Guardrail"
        : "Add Guardrail";
  }


  const idField =
    $("#brandRuleId");


  const typeField =
    $("#brandRuleType");


  const priorityField =
    $("#brandRulePriority");


  const textField =
    $("#brandRuleText");


  if (idField) {
    idField.value =
      rule?.id ||
      "";
  }


  if (typeField) {
    typeField.value =
      rule?.rule_type ||
      "general";
  }


  if (priorityField) {
    priorityField.value =
      Number(
        rule?.priority ||
        100
      );
  }


  if (textField) {
    textField.value =
      rule?.rule_text ||
      "";
  }


  safeDialogOpen(
    dialog
  );


  window.setTimeout(
    () => {
      textField?.focus();
    },
    100
  );
}


/* =========================================================
   SAVE AI GUARDRAIL
   ========================================================= */

async function handleBrandRuleSave(
  event
) {
  event.preventDefault();


  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return;
  }


  const ruleId =
    $("#brandRuleId")
      ?.value
      ?.trim();


  const ruleText =
    $("#brandRuleText")
      ?.value
      ?.trim();


  const ruleType =
    $("#brandRuleType")
      ?.value ||
    "general";


  let priority =
    Number(
      $("#brandRulePriority")
        ?.value
    );


  const button =
    $("#saveBrandRuleButton");


  if (!ruleText) {
    showToast(
      "Enter the guardrail the AI should follow.",
      "error"
    );


    $("#brandRuleText")
      ?.focus();


    return;
  }


  if (
    !Number.isFinite(
      priority
    ) ||
    priority < 1
  ) {
    priority =
      100;
  }


  priority =
    Math.round(
      priority
    );


  const payload = {
    brand_id:
      brand.id,

    rule_type:
      ruleType,

    rule_text:
      ruleText,

    priority,

    active:
      true
  };


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }


  try {
    let result;


    if (ruleId) {
      result =
        await supabaseClient
          .from("brand_rules")
          .update(
            payload
          )
          .eq(
            "id",
            ruleId
          )
          .eq(
            "brand_id",
            brand.id
          );
    } else {
      result =
        await supabaseClient
          .from("brand_rules")
          .insert(
            payload
          );
    }


    if (result.error) {
      throw result.error;
    }


    await reloadBrand(
      brand.id
    );


    safeDialogClose(
      $("#brandRuleDialog")
    );


    renderBrandBrainHeader();

    renderBrandBrainContent();


    showToast(
      ruleId
        ? "AI guardrail updated."
        : "AI guardrail added.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to save AI guardrail:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save the AI guardrail.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveBrandRuleButton");


    if (currentButton) {
      currentButton.disabled =
        false;
              currentButton.textContent =
        "Save Guardrail";
    }
  }
}


/* =========================================================
   ARCHIVE AI GUARDRAIL
   ========================================================= */

async function archiveBrandRule(
  ruleId
) {
  const brand =
    getBrandBrainBrand();


  const rule =
    getBrandRuleById(
      ruleId
    );


  if (
    !brand ||
    !rule
  ) {
    return;
  }


  const confirmed =
    window.confirm(
      `Archive this AI guardrail?\n\n"${rule.rule_text}"\n\nIt will stop being included in future AI instructions.`
    );


  if (!confirmed) {
    return;
  }


  try {
    const {
      error
    } =
      await supabaseClient
        .from("brand_rules")
        .update({
          active:
            false
        })
        .eq(
          "id",
          rule.id
        )
        .eq(
          "brand_id",
          brand.id
        );


    if (error) {
      throw error;
    }


    await reloadBrand(
      brand.id
    );


    renderBrandBrainContent();


    showToast(
      "AI guardrail archived.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to archive AI guardrail:",
      error
    );


    showToast(
      error?.message ||
      "Unable to archive the AI guardrail.",
      "error",
      5000
    );
  }
}


/* =========================================================
   AI GUARDRAIL CLICK HANDLING
   ========================================================= */

function handleBrandRulesClick(
  event
) {
  const addButton =
    event.target.closest(
      "[data-add-brand-rule]"
    );


  if (addButton) {
    showBrandRuleDialog();

    return;
  }


  const editButton =
    event.target.closest(
      "[data-edit-brand-rule]"
    );


  if (editButton) {
    showBrandRuleDialog(
      editButton.dataset
        .editBrandRule
    );

    return;
  }


  const archiveButton =
    event.target.closest(
      "[data-archive-brand-rule]"
    );


  if (archiveButton) {
    archiveBrandRule(
      archiveButton.dataset
        .archiveBrandRule
    );
  }
}


/* =========================================================
   BRAND MILESTONES
   ========================================================= */

function renderBrandMilestonesEditor(
  container,
  brand
) {
  const milestones =
    Array.isArray(
      brand.milestones
    )
      ? brand.milestones
          .slice()
          .sort(
            (a, b) => {
              const aCompleted =
                a.status === "completed";

              const bCompleted =
                b.status === "completed";


              if (
                aCompleted !==
                bCompleted
              ) {
                return aCompleted
                  ? 1
                  : -1;
              }


              const aDate =
                a.milestone_date
                  ? new Date(
                      `${a.milestone_date}T12:00:00`
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;


              const bDate =
                b.milestone_date
                  ? new Date(
                      `${b.milestone_date}T12:00:00`
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;


              return aDate - bDate;
            }
          )
      : [];


  const completedCount =
    milestones.filter(
      milestone =>
        milestone.status ===
        "completed"
    ).length;


  const opportunityCount =
    milestones.filter(
      milestone =>
        milestone.status ===
          "completed" &&
        milestone.marketing_worthy &&
        !milestone.content_created
    ).length;


  container.innerHTML = `
    ${brandBrainSectionHeader(
      "Milestones",
      "Turn real progress into marketing",
      "Track meaningful business progress here. Marketing-worthy milestones give Marketing Studio confirmed events it can safely turn into content."
    )}


    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(150px,1fr)
          );
        gap:10px;
        margin-bottom:20px;
      "
    >

      <div
        style="
          padding:14px;
          border:1px solid var(--line);
          border-radius:var(--radius);
          background:rgba(255,255,255,.018);
        "
      >
        <span class="eyebrow">
          Total
        </span>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-family:
              Georgia,
              'Times New Roman',
              serif;
            font-size:1.4rem;
            font-weight:400;
          "
        >
          ${milestones.length}
        </strong>
      </div>


      <div
        style="
          padding:14px;
          border:1px solid var(--line);
          border-radius:var(--radius);
          background:rgba(255,255,255,.018);
        "
      >
        <span class="eyebrow">
          Completed
        </span>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-family:
              Georgia,
              'Times New Roman',
              serif;
            font-size:1.4rem;
            font-weight:400;
          "
        >
          ${completedCount}
        </strong>
      </div>


      <div
        style="
          padding:14px;
          border:1px solid var(--line);
          border-radius:var(--radius);
          background:rgba(255,255,255,.018);
        "
      >
        <span class="eyebrow">
          Content Opportunities
        </span>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-family:
              Georgia,
              'Times New Roman',
              serif;
            font-size:1.4rem;
            font-weight:400;
          "
        >
          ${opportunityCount}
        </strong>
      </div>

    </div>


    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:14px;
        flex-wrap:wrap;
        margin-bottom:18px;
      "
    >

      <p
        style="
          margin:0;
          max-width:620px;
          color:var(--muted);
          font-size:.78rem;
          line-height:1.6;
        "
      >
        Completing a milestone does not publish anything.
        It simply records a confirmed event that can be
        used in future marketing.
      </p>


      <button
        class="primary-button"
        id="addBrandMilestoneButton"
        type="button"
      >
        + Add Milestone
      </button>

    </div>


    <div id="brandMilestonesList">

      ${
        milestones.length
          ? milestones
              .map(
                milestone =>
                  renderBrandMilestoneCard(
                    milestone
                  )
              )
              .join("")
          : `
            <div class="empty-state">

              <span
                class="empty-state-icon"
                aria-hidden="true"
              >
                ◇
              </span>

              <h3>
                No milestones yet.
              </h3>

              <p>
                Add the real-world moments that mark
                this brand's progress.
              </p>

              <button
                class="secondary-button"
                type="button"
                data-add-brand-milestone
              >
                Add First Milestone
              </button>

            </div>
          `
      }

    </div>


    <div
      class="form-actions"
      style="
        position:sticky;
        bottom:0;
        padding-top:14px;
        padding-bottom:2px;
        background:
          linear-gradient(
            180deg,
            transparent,
            rgba(7,8,11,.96) 25%
          );
      "
    >
      <button
        class="secondary-button"
        type="button"
        data-close-brand-brain
      >
        Close
      </button>
    </div>
  `;


  $("#addBrandMilestoneButton")
    ?.addEventListener(
      "click",
      () => {
        showBrandMilestoneDialog();
      }
    );
}


/* =========================================================
   MILESTONE CARD
   ========================================================= */

function renderBrandMilestoneCard(
  milestone
) {
  const status =
    milestone.status ||
    "planned";


  const completed =
    status === "completed";


  const contentOpportunity =
    completed &&
    milestone.marketing_worthy &&
    !milestone.content_created;


  return `
    <article
      class="content-panel"
      style="
        margin-bottom:12px;
        ${
          completed
            ? "opacity:.86;"
            : ""
        }
      "
      data-milestone-card="${
        escapeHtml(
          milestone.id
        )
      }"
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              flex-wrap:wrap;
              margin-bottom:9px;
            "
          >

            <span
              style="
                display:inline-flex;
                align-items:center;
                min-height:24px;
                padding:4px 8px;
                border:1px solid var(--line);
                border-radius:999px;
                color:var(--muted);
                font-size:.65rem;
                letter-spacing:.05em;
                text-transform:uppercase;
              "
            >
              ${
                escapeHtml(
                  titleCaseStatus(
                    status
                  )
                )
              }
            </span>


            ${
              milestone.marketing_worthy
                ? `
                  <span
                    style="
                      display:inline-flex;
                      align-items:center;
                      min-height:24px;
                      padding:4px 8px;
                      border:1px solid var(--line);
                      border-radius:999px;
                      color:var(--muted);
                      font-size:.65rem;
                      letter-spacing:.05em;
                      text-transform:uppercase;
                    "
                  >
                    Marketing Worthy
                  </span>
                `
                : ""
            }


            ${
              milestone.content_created
                ? `
                  <span
                    style="
                      display:inline-flex;
                      align-items:center;
                      min-height:24px;
                      padding:4px 8px;
                      border:1px solid var(--line);
                      border-radius:999px;
                      color:var(--muted);
                      font-size:.65rem;
                      letter-spacing:.05em;
                      text-transform:uppercase;
                    "
                  >
                    Content Created
                  </span>
                `
                : ""
            }

          </div>


          <h3
            style="
              margin:0 0 8px;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-size:1.08rem;
              font-weight:400;
            "
          >
            ${
              escapeHtml(
                milestone.title ||
                "Milestone"
              )
            }
          </h3>


          ${
            milestone.description
              ? `
                <p
                  style="
                    margin:0 0 10px;
                    color:var(--muted);
                    font-size:.78rem;
                    line-height:1.6;
                    white-space:pre-wrap;
                  "
                >
                  ${
                    escapeHtml(
                      milestone.description
                    )
                  }
                </p>
              `
              : ""
          }


          ${
            milestone.milestone_date
              ? `
                <p
                  style="
                    margin:0;
                    color:var(--muted);
                    font-size:.7rem;
                  "
                >
                  ${
                    escapeHtml(
                      formatDate(
                        milestone.milestone_date
                      )
                    )
                  }
                </p>
              `
              : ""
          }


          ${
            contentOpportunity
              ? `
                <div
                  style="
                    margin-top:14px;
                    padding:12px 14px;
                    border:1px solid var(--line);
                    border-radius:var(--radius);
                    background:rgba(255,255,255,.018);
                  "
                >
                  <span class="eyebrow">
                    Content Opportunity
                  </span>

                  <p
                    style="
                      margin:5px 0 0;
                      color:var(--muted);
                      font-size:.75rem;
                      line-height:1.55;
                    "
                  >
                    This is confirmed progress and may be
                    worth sharing with your audience.
                  </p>
                </div>
              `
              : ""
          }

        </div>


        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >

          ${
            !completed &&
            status !== "cancelled"
              ? `
                <button
                  class="secondary-button"
                  type="button"
                  data-complete-brand-milestone="${
                    escapeHtml(
                      milestone.id
                    )
                  }"
                >
                  Complete
                </button>
              `
              : ""
          }


          ${
            contentOpportunity
              ? `
                <button
                  class="primary-button"
                  type="button"
                  data-create-from-milestone="${
                    escapeHtml(
                      milestone.id
                    )
                  }"
                >
                  Create Post
                </button>
              `
              : ""
          }


          <button
            class="text-button"
            type="button"
            data-edit-brand-milestone="${
              escapeHtml(
                milestone.id
              )
            }"
          >
            Edit
          </button>

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   FIND MILESTONE
   ========================================================= */

function getBrandMilestoneById(
  milestoneId
) {
  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return null;
  }


  return (
    brand.milestones.find(
      milestone =>
        milestone.id ===
        milestoneId
    ) ||
    null
  );
}


/* =========================================================
   MILESTONE EDITOR DIALOG
   ========================================================= */

function ensureBrandMilestoneDialog() {
  let dialog =
    $("#brandMilestoneDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "brandMilestoneDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div
      style="
        width:min(700px,92vw);
        max-width:100%;
        max-height:88vh;
        overflow-y:auto;
      "
    >

      <div class="dialog-header">

        <div>

          <span class="eyebrow">
            Brand Progress
          </span>

          <h2
            id="brandMilestoneDialogTitle"
          >
            Add Milestone
          </h2>

        </div>


        <button
          id="closeBrandMilestoneDialogButton"
          class="dialog-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <form
        id="brandMilestoneForm"
        class="create-form"
      >

        <input
          id="brandMilestoneId"
          type="hidden"
        />


        <label class="field">

          <span>
            Milestone
          </span>

          <input
            id="brandMilestoneTitle"
            type="text"
            placeholder="Lease signed"
            required
          />

        </label>


        <label class="field">

          <span>
            Description
          </span>

          <textarea
            id="brandMilestoneDescription"
            style="
              min-height:120px;
            "
            placeholder="Add any context Marketing Studio should remember about this milestone."
          ></textarea>

        </label>


        ${brandBrainGridOpen()}

          <label class="field">

            <span>
              Status
            </span>

            <select
              id="brandMilestoneStatus"
            >

              <option value="planned">
                Planned
              </option>

              <option value="in_progress">
                In Progress
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="cancelled">
                Cancelled
              </option>

            </select>

          </label>


          <label class="field">

            <span>
              Milestone Date
            </span>

            <input
              id="brandMilestoneDate"
              type="date"
            />

          </label>

        </div>


        <div
          style="
            display:grid;
            gap:14px;
            padding:16px;
            border:1px solid var(--line);
            border-radius:var(--radius);
            background:rgba(255,255,255,.018);
          "
        >

          <label
            style="
              display:flex;
              align-items:flex-start;
              gap:10px;
              color:var(--ink);
              font-size:.8rem;
              line-height:1.5;
            "
          >

            <input
              id="brandMilestoneMarketingWorthy"
              type="checkbox"
              style="
                margin-top:3px;
              "
              checked
            />

            <span>

              <strong>
                Marketing worthy
              </strong>

              <small
                style="
                  display:block;
                  margin-top:3px;
                  color:var(--muted);
                  font-size:.7rem;
                "
              >
                This milestone may be worth turning
                into customer-facing content.
              </small>

            </span>

          </label>
                    <label
            style="
              display:flex;
              align-items:flex-start;
              gap:10px;
              color:var(--ink);
              font-size:.8rem;
              line-height:1.5;
            "
          >

            <input
              id="brandMilestoneContentCreated"
              type="checkbox"
              style="
                margin-top:3px;
              "
            />

            <span>

              <strong>
                Content already created
              </strong>

              <small
                style="
                  display:block;
                  margin-top:3px;
                  color:var(--muted);
                  font-size:.7rem;
                "
              >
                Prevent this milestone from appearing
                as an unused content opportunity.
              </small>

            </span>

          </label>

        </div>


        <div class="form-actions">

          <button
            id="cancelBrandMilestoneButton"
            class="secondary-button"
            type="button"
          >
            Cancel
          </button>

          <button
            id="saveBrandMilestoneButton"
            class="primary-button"
            type="submit"
          >
            Save Milestone
          </button>

        </div>

      </form>

    </div>
  `;


  document.body.appendChild(
    dialog
  );


  $("#closeBrandMilestoneDialogButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#cancelBrandMilestoneButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#brandMilestoneForm")
    ?.addEventListener(
      "submit",
      handleBrandMilestoneSave
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


/* =========================================================
   SHOW MILESTONE EDITOR
   ========================================================= */

function showBrandMilestoneDialog(
  milestoneId = null
) {
  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return;
  }


  const dialog =
    ensureBrandMilestoneDialog();


  const milestone =
    milestoneId
      ? getBrandMilestoneById(
          milestoneId
        )
      : null;


  const title =
    $("#brandMilestoneDialogTitle");


  if (title) {
    title.textContent =
      milestone
        ? "Edit Milestone"
        : "Add Milestone";
  }


  $("#brandMilestoneId").value =
    milestone?.id ||
    "";


  $("#brandMilestoneTitle").value =
    milestone?.title ||
    "";


  $("#brandMilestoneDescription").value =
    milestone?.description ||
    "";


  $("#brandMilestoneStatus").value =
    milestone?.status ||
    "planned";


  $("#brandMilestoneDate").value =
    milestone?.milestone_date ||
    "";


  $("#brandMilestoneMarketingWorthy").checked =
    milestone
      ? Boolean(
          milestone.marketing_worthy
        )
      : true;


  $("#brandMilestoneContentCreated").checked =
    Boolean(
      milestone?.content_created
    );


  safeDialogOpen(
    dialog
  );


  window.setTimeout(
    () => {
      $("#brandMilestoneTitle")
        ?.focus();
    },
    100
  );
}


/* =========================================================
   SAVE MILESTONE
   ========================================================= */

async function handleBrandMilestoneSave(
  event
) {
  event.preventDefault();


  const brand =
    getBrandBrainBrand();


  if (!brand) {
    return;
  }


  const milestoneId =
    $("#brandMilestoneId")
      ?.value
      ?.trim();


  const existing =
    milestoneId
      ? getBrandMilestoneById(
          milestoneId
        )
      : null;


  const title =
    $("#brandMilestoneTitle")
      ?.value
      ?.trim();


  const status =
    $("#brandMilestoneStatus")
      ?.value ||
    "planned";


  const button =
    $("#saveBrandMilestoneButton");


  if (!title) {
    showToast(
      "Give the milestone a title.",
      "error"
    );


    $("#brandMilestoneTitle")
      ?.focus();


    return;
  }


  let completedAt =
    existing?.completed_at ||
    null;


  if (
    status === "completed" &&
    !completedAt
  ) {
    completedAt =
      new Date()
        .toISOString();
  }


  if (
    status !== "completed"
  ) {
    completedAt =
      null;
  }


  const payload = {
    brand_id:
      brand.id,

    title,

    description:
      nullableText(
        $("#brandMilestoneDescription")
          ?.value
      ),

    status,

    milestone_date:
      nullableDate(
        $("#brandMilestoneDate")
          ?.value
      ),

    completed_at:
      completedAt,

    marketing_worthy:
      Boolean(
        $("#brandMilestoneMarketingWorthy")
          ?.checked
      ),

    content_created:
      Boolean(
        $("#brandMilestoneContentCreated")
          ?.checked
      )
  };


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }


  try {
    let result;


    if (milestoneId) {
      result =
        await supabaseClient
          .from("milestones")
          .update(
            payload
          )
          .eq(
            "id",
            milestoneId
          )
          .eq(
            "brand_id",
            brand.id
          );
    } else {
      result =
        await supabaseClient
          .from("milestones")
          .insert(
            payload
          );
    }


    if (result.error) {
      throw result.error;
    }


    await reloadBrand(
      brand.id
    );


    safeDialogClose(
      $("#brandMilestoneDialog")
    );


    renderBrandBrainHeader();

    renderBrandBrainContent();


    showToast(
      milestoneId
        ? "Milestone updated."
        : "Milestone added.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to save milestone:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save the milestone.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveBrandMilestoneButton");


    if (currentButton) {
      currentButton.disabled =
        false;

      currentButton.textContent =
        "Save Milestone";
    }
  }
}


/* =========================================================
   QUICK-COMPLETE MILESTONE
   ========================================================= */

async function completeBrandMilestone(
  milestoneId
) {
  const brand =
    getBrandBrainBrand();


  const milestone =
    getBrandMilestoneById(
      milestoneId
    );


  if (
    !brand ||
    !milestone
  ) {
    return;
  }


  try {
    const {
      error
    } =
      await supabaseClient
        .from("milestones")
        .update({
          status:
            "completed",

          completed_at:
            milestone.completed_at ||
            new Date()
              .toISOString()
        })
        .eq(
          "id",
          milestone.id
        )
        .eq(
          "brand_id",
          brand.id
        );


    if (error) {
      throw error;
    }


    await reloadBrand(
      brand.id
    );


    renderBrandBrainContent();


    if (
      milestone.marketing_worthy &&
      !milestone.content_created
    ) {
      showToast(
        "Milestone completed — this one is worth talking about.",
        "success"
      );
    } else {
      showToast(
        "Milestone completed.",
        "success"
      );
    }

  } catch (error) {
    console.error(
      "Unable to complete milestone:",
      error
    );


    showToast(
      error?.message ||
      "Unable to complete the milestone.",
      "error",
      5000
    );
  }
}


/* =========================================================
   CREATE CONTENT FROM MILESTONE
   ========================================================= */

function createContentFromMilestone(
  milestoneId
) {
  const brand =
    getBrandBrainBrand();


  const milestone =
    getBrandMilestoneById(
      milestoneId
    );


  if (
    !brand ||
    !milestone
  ) {
    return;
  }


  /*
    Close Brand Brain first so Quick Create
    becomes the active dialog instead of
    stacking dialogs.
  */

  safeDialogClose(
    $("#brandBrainDialog")
  );


  setActiveBrand(
    brand.id,
    {
      toast: false
    }
  );


  openQuickCreate(
    "social-post"
  );


  window.setTimeout(
    () => {
      const brandField =
        $("#createBrand");


      const promptField =
        $("#createPrompt");


      const goalField =
        $("#createGoal");


      if (brandField) {
        brandField.value =
          brand.id;
      }


      if (promptField) {
        const description =
          milestone.description
            ? ` Context: ${milestone.description}`
            : "";


        promptField.value =
          `Create a social post about this confirmed business milestone: "${milestone.title}".${description} The milestone is complete. Build the post around the real progress without inventing any additional facts, dates, offers, products, or availability.`;
      }


      if (goalField) {
        const availableValues =
          Array.from(
            goalField.options ||
            []
          ).map(
            option =>
              option.value
          );


        if (
          availableValues.includes(
            "awareness"
          )
        ) {
          goalField.value =
            "awareness";
        }
      }


      promptField?.focus();
    },
    50
  );
}


/* =========================================================
   MILESTONE CLICK HANDLING
   ========================================================= */

function handleBrandMilestonesClick(
  event
) {
  const addButton =
    event.target.closest(
      "[data-add-brand-milestone]"
    );


  if (addButton) {
    showBrandMilestoneDialog();

    return;
  }


  const editButton =
    event.target.closest(
      "[data-edit-brand-milestone]"
    );


  if (editButton) {
    showBrandMilestoneDialog(
      editButton.dataset
        .editBrandMilestone
    );

    return;
  }


  const completeButton =
    event.target.closest(
      "[data-complete-brand-milestone]"
    );


  if (completeButton) {
    completeBrandMilestone(
      completeButton.dataset
        .completeBrandMilestone
    );

    return;
  }


  const createButton =
    event.target.closest(
      "[data-create-from-milestone]"
    );


  if (createButton) {
    createContentFromMilestone(
      createButton.dataset
        .createFromMilestone
    );
  }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const brand =
    getActiveBrand();


  const greeting =
    $("#dashboardGreeting");


  if (greeting) {
    greeting.textContent =
      brand
        ? `Working on ${brand.shortName}`
        : "Your marketing workspace";
  }


  if (!brand) {
    setDashboardStat(
      "#reviewDraftCount",
      0
    );

    setDashboardStat(
      "#upcomingContentCount",
      0
    );

    setDashboardStat(
      "#activeCampaignCount",
      0
    );


    renderDashboardUpcoming(
      []
    );


    return;
  }


  const brandContent =
    APP_DATA.content.filter(
      item =>
        item.brandId ===
        brand.id
    );


  const reviewDrafts =
    brandContent.filter(
      item =>
        item.status ===
          "draft" ||
        item.status ===
          "review"
    );


  const now =
    new Date();


  const upcomingContent =
    brandContent
      .filter(
        item => {
          if (
            item.status !==
              "scheduled" ||
            !item.scheduledFor
          ) {
            return false;
          }


          const scheduled =
            new Date(
              item.scheduledFor
            );


          return (
            !Number.isNaN(
              scheduled.getTime()
            ) &&
            scheduled >= now
          );
        }
      )
      .sort(
        (a, b) =>
          new Date(
            a.scheduledFor
          ) -
          new Date(
            b.scheduledFor
          )
      );


  const activeCampaigns =
    APP_DATA.campaigns.filter(
      campaign =>
        campaign.brandId ===
          brand.id &&
        campaign.status ===
          "active"
    );


  setDashboardStat(
    "#reviewDraftCount",
    reviewDrafts.length
  );


  setDashboardStat(
    "#upcomingContentCount",
    upcomingContent.length
  );


  setDashboardStat(
    "#activeCampaignCount",
    activeCampaigns.length
  );


  renderDashboardUpcoming(
    upcomingContent
  );
}


function setDashboardStat(
  selector,
  value
) {
  const element =
    $(selector);


  if (element) {
    element.textContent =
      String(
        value
      );
  }
}


/* =========================================================
   DASHBOARD UPCOMING CONTENT
   ========================================================= */

function renderDashboardUpcoming(
  items
) {
  const container =
    $("#dashboardUpcoming");


  if (!container) {
    return;
  }


  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◇
        </span>

        <h3>
          Nothing scheduled yet.
        </h3>

        <p>
          Approved and scheduled content for the
          working brand will appear here.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    items
      .slice(
        0,
        5
      )
      .map(
        item => `
          <article
            class="content-panel"
            style="
              margin-bottom:10px;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:12px;
                flex-wrap:wrap;
              "
            >

              <div>

                <span class="eyebrow">
                  ${
                    escapeHtml(
                      getContentTypeLabel(
                        item.type
                      )
                    )
                  }
                </span>

                <h3
                  style="
                    margin:
                      5px 0 6px;
                    font-family:
                      Georgia,
                      'Times New Roman',
                      serif;
                    font-size:1rem;
                    font-weight:400;
                  "
                >
                  ${
                    escapeHtml(
                      item.title ||
                      "Untitled Content"
                    )
                  }
                </h3>

              </div>


              <span
                style="
                  color:var(--muted);
                  font-size:.72rem;
                  white-space:nowrap;
                "
              >
                ${
                  escapeHtml(
                    formatDateTime(
                      item.scheduledFor
                    )
                  )
                }
              </span>

            </div>

          </article>
        `
      )
      .join("");
}


/* =========================================================
   CONTENT TYPE LABEL
   ========================================================= */

function getContentTypeLabel(
  type
) {
  const normalized =
    DB_TYPE_TO_APP_TYPE[
      type
    ] ||
    type ||
    "content";


  return (
    CREATE_TYPES[
      normalized
          ]?.label ||
    titleCaseStatus(
      normalized
    )
  );
}


/* =========================================================
   CAMPAIGNS
   ========================================================= */

function renderCampaigns() {
  const container =
    $("#campaignList");


  if (!container) {
    return;
  }


  const brand =
    getActiveBrand();


  if (!brand) {
    container.innerHTML = `
      <div class="empty-state">

        <h3>
          Choose a working brand.
        </h3>

        <p>
          Campaigns are organized by brand.
        </p>

      </div>
    `;

    return;
  }


  const activeFilter =
    document.querySelector(
      "[data-campaign-filter].is-active"
    )
      ?.dataset
      ?.campaignFilter ||
    "all";


  let campaigns =
    APP_DATA.campaigns
      .filter(
        campaign =>
          campaign.brandId ===
          brand.id
      )
      .slice();


  if (
    activeFilter !==
    "all"
  ) {
    campaigns =
      campaigns.filter(
        campaign =>
          campaign.status ===
          activeFilter
      );
  }


  campaigns.sort(
    (a, b) =>
      new Date(
        b.updatedAt ||
        b.createdAt ||
        0
      ) -
      new Date(
        a.updatedAt ||
        a.createdAt ||
        0
      )
  );


  if (!campaigns.length) {
    container.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◇
        </span>

        <h3>
          ${
            activeFilter ===
              "all"
              ? "No campaigns yet."
              : `No ${escapeHtml(
                  titleCaseStatus(
                    activeFilter
                  )
                )} campaigns.`
          }
        </h3>

        <p>
          Build campaigns around real goals,
          launches, offers, events, or brand
          milestones.
        </p>

        <button
          class="secondary-button"
          type="button"
          data-create-type="campaign"
        >
          Create Campaign
        </button>

      </div>
    `;

    return;
  }


  container.innerHTML =
    campaigns
      .map(
        campaign =>
          renderCampaignCard(
            campaign
          )
      )
      .join("");
}


/* =========================================================
   CAMPAIGN CARD
   ========================================================= */

function renderCampaignCard(
  campaign
) {
  const channels =
    Array.isArray(
      campaign.channels
    )
      ? campaign.channels
      : [];


  const dateParts = [];


  if (campaign.startsOn) {
    dateParts.push(
      `Starts ${
        formatDate(
          campaign.startsOn
        )
      }`
    );
  }


  if (campaign.endsOn) {
    dateParts.push(
      `Ends ${
        formatDate(
          campaign.endsOn
        )
      }`
    );
  }


  return `
    <article
      class="content-panel"
      style="
        margin-bottom:12px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              flex-wrap:wrap;
              margin-bottom:8px;
            "
          >

            <span class="eyebrow">
              Campaign
            </span>

            <span
              style="
                display:inline-flex;
                align-items:center;
                min-height:24px;
                padding:4px 8px;
                border:1px solid var(--line);
                border-radius:999px;
                color:var(--muted);
                font-size:.65rem;
                letter-spacing:.05em;
                text-transform:uppercase;
              "
            >
              ${
                escapeHtml(
                  titleCaseStatus(
                    campaign.status
                  )
                )
              }
            </span>

          </div>


          <h3
            style="
              margin:
                0 0 8px;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-size:1.08rem;
              font-weight:400;
            "
          >
            ${
              escapeHtml(
                campaign.name ||
                "Untitled Campaign"
              )
            }
          </h3>


          ${
            campaign.description
              ? `
                <p
                  style="
                    margin:
                      0 0 10px;
                    color:var(--muted);
                    font-size:.78rem;
                    line-height:1.6;
                    white-space:pre-wrap;
                  "
                >
                  ${
                    escapeHtml(
                      campaign.description
                    )
                  }
                </p>
              `
              : ""
          }


          ${
            campaign.objective
              ? `
                <p
                  style="
                    margin:
                      0 0 8px;
                    color:var(--ink);
                    font-size:.76rem;
                    line-height:1.55;
                  "
                >
                  <strong>
                    Objective:
                  </strong>

                  ${
                    escapeHtml(
                      campaign.objective
                    )
                  }
                </p>
              `
              : ""
          }


          ${
            channels.length
              ? `
                <p
                  style="
                    margin:
                      0 0 8px;
                    color:var(--muted);
                    font-size:.7rem;
                    line-height:1.5;
                  "
                >
                  ${
                    escapeHtml(
                      channels.join(
                        " · "
                      )
                    )
                  }
                </p>
              `
              : ""
          }


          ${
            dateParts.length
              ? `
                <small
                  style="
                    display:block;
                    color:var(--muted);
                    font-size:.68rem;
                  "
                >
                  ${
                    escapeHtml(
                      dateParts.join(
                        " · "
                      )
                    )
                  }
                </small>
              `
              : ""
          }

        </div>


        <button
          class="secondary-button"
          type="button"
          data-create-type="campaign"
          data-campaign-id="${
            escapeHtml(
              campaign.id
            )
          }"
        >
          Build Content
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   CAMPAIGN FILTERS
   ========================================================= */

function setCampaignFilter(
  filter
) {
  $$(
    "[data-campaign-filter]"
  ).forEach(
    button => {
      button.classList.toggle(
        "is-active",
        button.dataset
          .campaignFilter ===
          filter
      );
    }
  );


  renderCampaigns();
}


/* =========================================================
   CONTENT LIBRARY
   ========================================================= */

function renderContentLibrary() {
  const container =
    $("#contentLibrary");


  if (!container) {
    return;
  }


  const brand =
    getActiveBrand();


  if (!brand) {
    container.innerHTML = `
      <div class="empty-state">

        <h3>
          Choose a working brand.
        </h3>

        <p>
          Content is organized by brand.
        </p>

      </div>
    `;

    return;
  }


  const activeFilter =
    document.querySelector(
      "[data-content-filter].is-active"
    )
      ?.dataset
      ?.contentFilter ||
    "all";


  let items =
    APP_DATA.content
      .filter(
        item =>
          item.brandId ===
          brand.id
      )
      .slice();


  if (
    activeFilter !==
    "all"
  ) {
    items =
      items.filter(
        item =>
          item.status ===
          activeFilter
      );
  }


  items.sort(
    (a, b) =>
      new Date(
        b.updatedAt ||
        b.createdAt ||
        0
      ) -
      new Date(
        a.updatedAt ||
        a.createdAt ||
        0
      )
  );


  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◇
        </span>

        <h3>
          ${
            activeFilter ===
              "all"
              ? "No content yet."
              : `No ${escapeHtml(
                  titleCaseStatus(
                    activeFilter
                  )
                )} content.`
          }
        </h3>

        <p>
          Start with Quick Create or one of the
          Content Studio tools.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    items
      .map(
        item =>
          renderContentCard(
            item
          )
      )
      .join("");
}


/* =========================================================
   CONTENT EDITOR
   ========================================================= */

function ensureContentEditorDialog() {
  let dialog =
    $("#contentEditorDialog");


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      "dialog"
    );


  dialog.id =
    "contentEditorDialog";


  dialog.className =
    "app-dialog create-dialog";


  dialog.innerHTML = `
    <div
      style="
        width:min(760px,94vw);
        max-width:100%;
        max-height:92vh;
        overflow-y:auto;
      "
    >

      <div class="dialog-header">

        <div>

          <span
            id="contentEditorEyebrow"
            class="eyebrow"
          >
            Content
          </span>

          <h2 id="contentEditorHeading">
            Edit Content
          </h2>

        </div>


        <button
          id="closeContentEditorButton"
          class="dialog-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <form
        id="contentEditorForm"
        class="create-form"
      >

        <input
          id="contentEditorId"
          type="hidden"
        />


        <label class="field">

          <span>
            Title
          </span>

          <input
            id="contentEditorTitle"
            type="text"
            placeholder="Content title"
          />

        </label>


        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(
                2,
                minmax(0,1fr)
              );
            gap:12px;
          "
        >

          <label class="field">

            <span>
              Platform
            </span>

            <input
              id="contentEditorPlatform"
              type="text"
              placeholder="Facebook, Instagram…"
            />

          </label>


          <label class="field">

            <span>
              Status
            </span>

            <select id="contentEditorStatus">

              <option value="draft">
                Draft
              </option>

              <option value="review">
                Review
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="scheduled">
                Scheduled
              </option>

              <option value="published">
                Published
              </option>

            </select>

          </label>

        </div>


        <label class="field">

          <span>
            Content
          </span>

          <textarea
            id="contentEditorBody"
            style="
              min-height:300px;
            "
            placeholder="Write or edit the content here."
          ></textarea>

        </label>


        <label class="field">

          <span>
            Goal
          </span>

          <input
            id="contentEditorGoal"
            type="text"
            placeholder="Build awareness, drive bookings…"
          />

        </label>


        <label
          id="contentEditorScheduleField"
          class="field"
          hidden
        >

          <span>
            Scheduled date &amp; time
          </span>

          <input
            id="contentEditorScheduledFor"
            type="datetime-local"
          />

        </label>


        <div
          style="
            padding-top:4px;
            color:var(--muted);
            font-size:.7rem;
            line-height:1.55;
          "
        >
          Saving updates this content item only.
          Scheduling does not publish it.
        </div>


        <div class="form-actions">

          <button
            id="cancelContentEditorButton"
            class="secondary-button"
            type="button"
          >
            Cancel
          </button>

          <button
            id="saveContentEditorButton"
            class="primary-button"
            type="submit"
          >
            Save Changes
          </button>

        </div>

      </form>

    </div>
  `;


  document.body.appendChild(
    dialog
  );


  $("#closeContentEditorButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#cancelContentEditorButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );


  $("#contentEditorStatus")
    ?.addEventListener(
      "change",
      updateContentEditorScheduleVisibility
    );


  $("#contentEditorForm")
    ?.addEventListener(
      "submit",
      saveContentEditor
    );


  enableBackdropClose(
    dialog
  );


  return dialog;
}


/* =========================================================
   OPEN CONTENT EDITOR
   ========================================================= */

function openContentEditor(
  contentId
) {
  const item =
    APP_DATA.content.find(
      content =>
        content.id ===
        contentId
    );


  if (!item) {
    showToast(
      "That content item could not be found.",
      "error"
    );

    return;
  }


  const dialog =
    ensureContentEditorDialog();


  $("#contentEditorId").value =
    item.id;


  $("#contentEditorTitle").value =
    item.title ||
    "";


  $("#contentEditorPlatform").value =
    item.platform ||
    "";


  $("#contentEditorStatus").value =
    item.status ||
    "draft";


  $("#contentEditorBody").value =
    item.body ||
    "";


  $("#contentEditorGoal").value =
    item.goal ||
    "";


  $("#contentEditorEyebrow").textContent =
    getContentTypeLabel(
      item.type
    );


  $("#contentEditorHeading").textContent =
    item.title ||
    "Edit Content";


  const scheduleInput =
    $("#contentEditorScheduledFor");


  if (scheduleInput) {
    scheduleInput.value =
      toLocalDateTimeInputValue(
        item.scheduledFor
      );
  }


  updateContentEditorScheduleVisibility();


  safeDialogOpen(
    dialog
  );
}


/* =========================================================
   CONTENT EDITOR SCHEDULE VISIBILITY
   ========================================================= */

function updateContentEditorScheduleVisibility() {
  const status =
    $("#contentEditorStatus")
      ?.value;


  const field =
    $("#contentEditorScheduleField");


  if (!field) {
    return;
  }


  field.hidden =
    status !==
    "scheduled";
}


/* =========================================================
   DATETIME INPUT VALUE
   ========================================================= */

function toLocalDateTimeInputValue(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  const pad =
    number =>
      String(number)
        .padStart(
          2,
          "0"
        );


  return [
    date.getFullYear(),
    "-",
    pad(
      date.getMonth() + 1
    ),
    "-",
    pad(
      date.getDate()
    ),
    "T",
    pad(
      date.getHours()
    ),
    ":",
    pad(
      date.getMinutes()
    )
  ].join("");
}


/* =========================================================
   SAVE CONTENT EDITOR
   ========================================================= */

async function saveContentEditor(
  event
) {
  event.preventDefault();


  const id =
    $("#contentEditorId")
      ?.value;


  const title =
    $("#contentEditorTitle")
      ?.value
      ?.trim();


  const platform =
    $("#contentEditorPlatform")
      ?.value
      ?.trim();


  const status =
    $("#contentEditorStatus")
      ?.value ||
    "draft";


  const body =
    $("#contentEditorBody")
      ?.value
      ?.trim();


  const goal =
    $("#contentEditorGoal")
      ?.value
      ?.trim();


  const scheduledInput =
    $("#contentEditorScheduledFor")
      ?.value;


  if (!id) {
    showToast(
      "The content item is missing.",
      "error"
    );

    return;
  }


  if (!title) {
    showToast(
      "Give this content a title.",
      "error"
    );


    $("#contentEditorTitle")
      ?.focus();


    return;
  }


  if (!body) {
    showToast(
      "Content cannot be empty.",
      "error"
    );


    $("#contentEditorBody")
      ?.focus();


    return;
  }


  if (
    status ===
      "scheduled" &&
    !scheduledInput
  ) {
    showToast(
      "Choose a date and time before scheduling.",
      "error"
    );


    $("#contentEditorScheduledFor")
      ?.focus();


    return;
  }


  const button =
    $("#saveContentEditorButton");


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }


  try {
    const scheduledFor =
      status ===
        "scheduled"
        ? new Date(
            scheduledInput
          ).toISOString()
        : null;


    const payload = {
      title,
      body,

      platform:
        nullableText(
          platform
        ),

      goal:
        nullableText(
          goal
        ),

      status,

      scheduled_for:
        scheduledFor,

      updated_at:
        new Date()
          .toISOString()
    };


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "content_items"
        )
        .update(
          payload
        )
        .eq(
          "id",
          id
        )
        .select()
        .single();


    if (error) {
      throw error;
    }


    if (!data?.id) {
      throw new Error(
        "The content update did not return a saved item."
      );
    }


    safeDialogClose(
      $("#contentEditorDialog")
    );


    await refreshWorkingData();


    renderDashboard();

    renderCampaigns();

    renderContentLibrary();

    renderCalendar();

    renderAssets();


    showToast(
      status ===
        "scheduled"
        ? "Content scheduled."
        : "Changes saved.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to update content:",
      error
    );


    showToast(
      error?.message ||
      "Unable to save the content.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveContentEditorButton");


    if (currentButton) {
      currentButton.disabled =
        false;

      currentButton.textContent =
        "Save Changes";
    }
  }
}


/* =========================================================
   CONTENT CARD
   ========================================================= */

function renderContentCard(
  item
) {
  const preview =
    item.body ||
    item.originalRequest ||
    "";


  return `
    <article
      class="content-panel"
      data-open-content="${
        escapeHtml(
          item.id
        )
      }"
      role="button"
      tabindex="0"
      aria-label="Open ${
        escapeHtml(
          item.title ||
          "content"
        )
      }"
      style="
        margin-bottom:12px;
        cursor:pointer;
        transition:
          transform .18s var(--ease),
          border-color .18s var(--ease),
          background .18s var(--ease);
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              flex-wrap:wrap;
              margin-bottom:8px;
            "
          >

            <span class="eyebrow">
              ${
                escapeHtml(
                  getContentTypeLabel(
                    item.type
                  )
                )
              }
            </span>

            <span
              style="
                display:inline-flex;
                align-items:center;
                min-height:24px;
                padding:4px 8px;
                border:1px solid var(--line);
                border-radius:999px;
                color:var(--muted);
                font-size:.65rem;
                letter-spacing:.05em;
                text-transform:uppercase;
              "
            >
              ${
                escapeHtml(
                  titleCaseStatus(
                    item.status
                  )
                )
              }
            </span>

          </div>


          <h3
            style="
              margin:0 0 8px;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-size:1.08rem;
              font-weight:400;
            "
          >
            ${
              escapeHtml(
                              item.title ||
                "Untitled Content"
              )
            }
          </h3>


          ${
            preview
              ? `
                <p
                  style="
                    margin:0 0 9px;
                    color:var(--muted);
                    font-size:.78rem;
                    line-height:1.6;
                    white-space:pre-wrap;
                  "
                >
                  ${
                    escapeHtml(
                      truncateText(
                        preview,
                        260
                      )
                    )
                  }
                </p>
              `
              : ""
          }


          <div
            style="
              display:flex;
              gap:10px;
              flex-wrap:wrap;
              color:var(--muted);
              font-size:.68rem;
            "
          >

            ${
              item.platform
                ? `
                  <span>
                    ${
                      escapeHtml(
                        item.platform
                      )
                    }
                  </span>
                `
                : ""
            }

            ${
              item.goal
                ? `
                  <span>
                    •
                    ${
                      escapeHtml(
                        item.goal
                      )
                    }
                  </span>
                `
                : ""
            }

            ${
              item.scheduledFor
                ? `
                  <span>
                    Scheduled:
                    ${
                      escapeHtml(
                        formatDateTime(
                          item.scheduledFor
                        )
                      )
                    }
                  </span>
                `
                : ""
            }

          </div>

        </div>


        <span
          aria-hidden="true"
          style="
            flex:0 0 auto;
            color:var(--bronze-light);
            font-size:1.1rem;
            line-height:1;
            padding-top:4px;
          "
        >
          ›
        </span>

      </div>

    </article>
  `;
}


/* =========================================================
   TEXT PREVIEW
   ========================================================= */

function truncateText(
  value,
  maxLength = 220
) {
  const text =
    String(
      value ||
      ""
    )
      .trim();


  if (
    text.length <=
    maxLength
  ) {
    return text;
  }


  return (
    text
      .slice(
        0,
        maxLength
      )
      .trimEnd() +
    "…"
  );
}


/* =========================================================
   CONTENT FILTERS
   ========================================================= */

function setContentFilter(
  filter
) {
  $$(
    "[data-content-filter]"
  ).forEach(
    button => {
      button.classList.toggle(
        "is-active",
        button.dataset
          .contentFilter ===
          filter
      );
    }
  );


  renderContentLibrary();
}


/* =========================================================
   CALENDAR
   ========================================================= */

function renderCalendar() {
  const container =
    $("#calendarShell");


  if (!container) {
    return;
  }


  const brand =
    getActiveBrand();


  if (!brand) {
    container.innerHTML = `
      <div class="empty-state">

        <h3>
          Choose a working brand.
        </h3>

        <p>
          Calendar items are organized by brand.
        </p>

      </div>
    `;

    return;
  }


  const calendarItems =
    APP_DATA.calendar
      .filter(
        item =>
          item.brandId ===
          brand.id
      );


  const scheduledContent =
    APP_DATA.content
      .filter(
        item =>
          item.brandId ===
            brand.id &&
          item.status ===
            "scheduled" &&
          item.scheduledFor
      )
      .map(
        item => ({
          id:
            `content-${item.id}`,

          contentId:
            item.id,

          brandId:
            item.brandId,

          type:
            getContentTypeLabel(
              item.type
            ),

          itemType:
            "scheduled-content",

          title:
            item.title ||
            "Scheduled Content",

          description:
            [
              item.platform,
              item.goal
            ]
              .filter(Boolean)
              .join(" · "),

          startsAt:
            item.scheduledFor,

          endsAt:
            null,

          startAt:
            item.scheduledFor,

          endAt:
            null,

          publishAt:
            item.scheduledFor,

          allDay:
            false,

          recurring:
            false,

          recurrenceRule:
            "",

          marketingRelevant:
            true,

          sourceType:
            "content",

          confirmed:
            true
        })
      );


  const items =
    [
      ...calendarItems,
      ...scheduledContent
    ]
      .sort(
        (a, b) => {
          const aTime =
            a.startsAt
              ? new Date(
                  a.startsAt
                ).getTime()
              : Number.MAX_SAFE_INTEGER;


          const bTime =
            b.startsAt
              ? new Date(
                  b.startsAt
                ).getTime()
              : Number.MAX_SAFE_INTEGER;


          return aTime - bTime;
        }
      );


  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◇
        </span>

        <h3>
          The calendar is clear.
        </h3>

        <p>
          Scheduled content, launches, events,
          holidays, and other marketing-relevant
          dates will appear here.
        </p>

      </div>
    `;

    return;
  }


  const grouped =
    groupCalendarItemsByMonth(
      items
    );


  container.innerHTML =
    Object.entries(
      grouped
    )
      .map(
        ([month, monthItems]) => `
          <section
            style="
              margin-bottom:26px;
            "
          >

            <div
              style="
                display:flex;
                align-items:center;
                gap:12px;
                margin-bottom:12px;
              "
            >

              <span class="eyebrow">
                ${escapeHtml(month)}
              </span>

              <div
                style="
                  flex:1;
                  height:1px;
                  background:var(--line);
                "
              ></div>

            </div>


            <div>

              ${
                monthItems
                  .map(
                    item =>
                      renderCalendarItem(
                        item
                      )
                  )
                  .join("")
              }

            </div>

          </section>
        `
      )
      .join("");
}


/* =========================================================
   GROUP CALENDAR ITEMS
   ========================================================= */

function groupCalendarItemsByMonth(
  items
) {
  const groups = {};


  items.forEach(
    item => {
      if (!item.startsAt) {
        const key =
          "Unscheduled";


        groups[key] ||= [];

        groups[key].push(
          item
        );

        return;
      }


      const date =
        new Date(
          item.startsAt
        );


      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        const key =
          "Unscheduled";


        groups[key] ||= [];

        groups[key].push(
          item
        );

        return;
      }


      const key =
        date.toLocaleDateString(
          undefined,
          {
            month:
              "long",

            year:
              "numeric"
          }
        );


      groups[key] ||= [];

      groups[key].push(
        item
      );
    }
  );


  return groups;
}


/* =========================================================
   CALENDAR ITEM
   ========================================================= */

function renderCalendarItem(
  item
) {
  const startLabel =
    item.startsAt
      ? (
          item.allDay
            ? formatDate(
                item.startsAt
              )
            : formatDateTime(
                item.startsAt
              )
        )
      : "No date";


  const endLabel =
    item.endsAt
      ? (
          item.allDay
            ? formatDate(
                item.endsAt
              )
            : formatDateTime(
                item.endsAt
              )
        )
      : "";


  const isScheduledContent =
    item.itemType === "scheduled-content" &&
    item.contentId;

  const calendarItemId =
    isScheduledContent
      ? item.contentId
      : item.id;

  const calendarAction =
    isScheduledContent
      ? "content"
      : "calendar";


  return `
    <article
      class="content-panel calendar-item-card"
      data-calendar-action="${escapeHtml(calendarAction)}"
      data-calendar-item-id="${escapeHtml(calendarItemId)}"
      role="button"
      tabindex="0"
      aria-label="Open ${escapeHtml(
        item.title || "calendar item"
      )}"
      style="
        margin-bottom:10px;
        cursor:pointer;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              flex-wrap:wrap;
              margin-bottom:7px;
            "
          >

            <span class="eyebrow">
              ${
                escapeHtml(
                  titleCaseStatus(
                    item.type ||
                    "calendar"
                  )
                )
              }
            </span>


            ${
              item.marketingRelevant
                ? `
                  <span
                    style="
                      display:inline-flex;
                      align-items:center;
                      min-height:24px;
                      padding:4px 8px;
                      border:1px solid var(--line);
                      border-radius:999px;
                      color:var(--muted);
                      font-size:.65rem;
                      letter-spacing:.05em;
                      text-transform:uppercase;
                    "
                  >
                    Marketing Relevant
                  </span>
                `
                : ""
            }


            ${
              item.confirmed
                ? `
                  <span
                    style="
                      display:inline-flex;
                      align-items:center;
                      min-height:24px;
                      padding:4px 8px;
                      border:1px solid var(--line);
                      border-radius:999px;
                      color:var(--muted);
                      font-size:.65rem;
                      letter-spacing:.05em;
                      text-transform:uppercase;
                    "
                  >
                    Confirmed
                  </span>
                `
                : ""
            }

          </div>


          <h3
            style="
              margin:
                0 0 7px;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-size:1.04rem;
              font-weight:400;
            "
          >
            ${
              escapeHtml(
                item.title ||
                "Calendar Item"
              )
            }
          </h3>


          ${
            item.description
              ? `
                <p
                  style="
                    margin:0;
                    color:var(--muted);
                    font-size:.76rem;
                    line-height:1.6;
                    white-space:pre-wrap;
                  "
                >
                  ${
                    escapeHtml(
                      item.description
                    )
                  }
                </p>
              `
              : ""
          }

        </div>


        <div
          style="
            color:var(--muted);
            font-size:.7rem;
            line-height:1.5;
            text-align:right;
          "
        >

          <div>
            ${escapeHtml(startLabel)}
          </div>


          ${
            endLabel
              ? `
                <div>
                  to
                  ${escapeHtml(endLabel)}
                </div>
              `
              : ""
          }

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   ASSET VAULT
   ========================================================= */

function renderAssets() {
  const container =
    $("#assetGrid");


  if (!container) {
    return;
  }


  const brand =
    getActiveBrand();


  if (!brand) {
    container.innerHTML = `
      <div class="empty-state">

        <h3>
          Choose a working brand.
        </h3>

        <p>
          Brand assets are organized by brand.
        </p>

      </div>
    `;

    return;
  }


  const activeFilter =
    document.querySelector(
      "[data-asset-filter].is-active"
    )
      ?.dataset
      ?.assetFilter ||
    "all";


  const activeFolderId =
    APP_STATE.activeAssetFolderId ||
    null;


  /*
   * FOLDERS
   *
   * At the root, show folders that do not
   * have a parent.
   *
   * Inside a folder, show its child folders.
   */
  let folders =
    (
      APP_DATA.assetFolders ||
      []
    )
      .filter(
        folder =>
          String(
            folder.brandId
          ) ===
          String(
            brand.id
          )
      )
      .filter(
        folder => {
          if (activeFolderId) {
            return (
              String(
                folder.parentFolderId ||
                ""
              ) ===
              String(
                activeFolderId
              )
            );
          }

          return (
            !folder.parentFolderId
          );
        }
      )
      .slice();


  folders.sort(
    (a, b) =>
      String(
        a.name || ""
      ).localeCompare(
        String(
          b.name || ""
        )
      )
  );


  /*
   * ASSETS
   */
  let assets =
    APP_DATA.assets
      .filter(
        asset =>
          String(
            asset.brandId
          ) ===
            String(
              brand.id
            ) &&
          asset.active !==
            false
      )
      .filter(
        asset => {
          if (activeFolderId) {
            return (
              String(
                asset.folderId ||
                ""
              ) ===
              String(
                activeFolderId
              )
            );
          }


          /*
           * Root view only shows assets
           * that are not inside a folder.
           */
          return !asset.folderId;
        }
      )
      .slice();


  if (
    activeFilter !==
    "all"
  ) {
    assets =
      assets.filter(
        asset =>
          assetMatchesFilter(
            asset,
            activeFilter
          )
      );
  }


  assets.sort(
    (a, b) =>
      new Date(
        b.updatedAt ||
        b.createdAt ||
        0
      ) -
      new Date(
        a.updatedAt ||
        a.createdAt ||
        0
      )
  );


  /*
   * CURRENT FOLDER
   */
  const currentFolder =
    activeFolderId
      ? (
          APP_DATA.assetFolders ||
          []
        ).find(
          folder =>
            String(
              folder.id
            ) ===
            String(
              activeFolderId
            )
        )
      : null;


  /*
   * TOOLBAR
   */
  const toolbarHtml = `
    <div
      style="
        grid-column:1 / -1;
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:4px;
      "
    >

      <div
        style="
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:10px;
        "
      >

        ${
          currentFolder
            ? `
              <button
                class="secondary-button"
                type="button"
                data-asset-folder-back
              >
                ← Back
              </button>

              <strong>
                ${escapeHtml(
                  currentFolder.name
                )}
              </strong>

              <button
                class="secondary-button"
                type="button"
                data-rename-current-asset-folder="${
                  escapeHtml(
                    currentFolder.id
                  )
                }"
              >
                Rename
              </button>

              <button
                class="danger-button"
                type="button"
                data-delete-asset-folder="${
                  escapeHtml(
                    currentFolder.id
                  )
                }"
              >
                Delete
              </button>
            `
            : ""
        }

      </div>


      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:10px;
        "
      >

        <button
          class="secondary-button"
          type="button"
          data-create-asset-folder
        >
          + Create Folder
        </button>

        <button
          class="secondary-button"
          type="button"
          data-add-asset
        >
          + Add Asset
        </button>

      </div>

    </div>
  `;


  /*
   * FOLDER CARDS
   */
  const foldersHtml =
    folders
      .map(
        folder => `
          <article
            class="content-panel"
            data-open-asset-folder="${
              escapeHtml(
                folder.id
                              )
            }"
            role="button"
            tabindex="0"
            style="
              min-width:0;
              cursor:pointer;
            "
          >

            <div
              style="
                aspect-ratio:4 / 3;
                display:flex;
                align-items:center;
                justify-content:center;
                margin-bottom:12px;
                border:1px solid var(--line);
                border-radius:calc(
                  var(--radius) - 4px
                );
                background:
                  rgba(255,255,255,.02);
                font-size:44px;
              "
              aria-hidden="true"
            >
              ◇
            </div>

            <div
              class="eyebrow"
            >
              Folder
            </div>

            <h3
              style="
                margin-top:6px;
                margin-bottom:0;
              "
            >
              ${escapeHtml(
                folder.name ||
                "Untitled Folder"
              )}
            </h3>

          </article>
        `
      )
      .join("");


  /*
   * ASSET CARDS
   */
  const assetsHtml =
    assets
      .map(
        asset =>
          renderAssetCard(
            asset
          )
      )
      .join("");


  /*
   * EMPTY FOLDER / EMPTY VAULT
   */
  if (
    !folders.length &&
    !assets.length
  ) {
    container.innerHTML = `
      ${toolbarHtml}

      <div
        class="empty-state"
        style="
          grid-column:1 / -1;
        "
      >

        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◇
        </span>

        <h3>
          ${
            currentFolder
              ? "This folder is empty."
              : (
                  activeFilter ===
                    "all"
                    ? "The Asset Vault is empty."
                    : `No ${escapeHtml(
                        titleCaseStatus(
                          activeFilter
                        )
                      )} here yet.`
                )
          }
        </h3>

        <p>
          ${
            currentFolder
              ? "Add assets or create another folder here."
              : "Create folders to organize your library, or add assets individually."
          }
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML = `
    ${toolbarHtml}
    ${foldersHtml}
    ${assetsHtml}
  `;
}


/* =========================================================
   ASSET FILTER MATCHING
   ========================================================= */

function assetMatchesFilter(
  asset,
  filter
) {
  const type =
    asset.category ||
    "other";


  switch (filter) {
    case "logos":
      return (
        type === "logo"
      );


    case "photos":
      return (
        type === "photo"
      );


    case "generated":
      return (
        type ===
        "generated_artwork"
      );


    case "brand":
      return (
        type ===
        "brand_asset"
      );


    default:
      return true;
  }
}


/* =========================================================
   ASSET CARD
   ========================================================= */

async function hydrateAssetSignedUrls(
  assets
) {
  if (
    !supabaseClient ||
    !Array.isArray(assets)
  ) {
    return assets || [];
  }


  await Promise.all(
    assets.map(
      async asset => {
        if (!asset) {
          return;
        }


        /*
         * Assets that already have an
         * external URL don't need a
         * Supabase signed URL.
         */
        if (asset.externalUrl) {
          asset.signedUrl =
            asset.externalUrl;

          return;
        }


        if (
          !asset.storageBucket ||
          !asset.storagePath
        ) {
          asset.signedUrl = "";
          return;
        }


        try {
          const {
            data,
            error
          } =
            await supabaseClient
              .storage
              .from(
                asset.storageBucket
              )
              .createSignedUrl(
                asset.storagePath,
                60 * 60
              );


          if (error) {
            throw error;
          }


          asset.signedUrl =
            data?.signedUrl || "";

        } catch (error) {
          console.warn(
            "Could not create signed asset URL:",
            asset.name,
            error
          );


          asset.signedUrl = "";
        }
      }
    )
  );


  return assets;
}


function getAssetDisplayUrl(
  asset
) {
  if (!asset) {
    return "";
  }


  return (
    asset.signedUrl ||
    asset.externalUrl ||
    ""
  );
}


function renderAssetCard(
  asset
) {
  const imageUrl =
    getAssetDisplayUrl(
      asset
    );


  const isImage =
    asset.mimeType
      ?.startsWith(
        "image/"
      ) ||
    [
      "logo",
      "photo",
      "generated_artwork",
      "brand_asset"
    ].includes(
      asset.category
    );


  return `
    <article
      class="content-panel"
      data-open-asset="${
        escapeHtml(
          asset.id
        )
      }"
      role="button"
      tabindex="0"
      style="
        min-width:0;
        overflow:hidden;
        cursor:pointer;
      "
    >

      ${
        imageUrl &&
        isImage
          ? `
            <div
              style="
                aspect-ratio:4 / 3;
                margin-bottom:12px;
                border:1px solid var(--line);
                border-radius:calc(
                  var(--radius) - 4px
                );
                overflow:hidden;
                background:
                  rgba(255,255,255,.02);
              "
            >

              <img
                src="${
                  escapeHtml(
                    imageUrl
                  )
                }"
                alt="${
                  escapeHtml(
                    asset.altText ||
                    asset.name ||
                    ""
                  )
                }"
                loading="lazy"
                style="
                  display:block;
                  width:100%;
                  height:100%;
                  object-fit:cover;
                "
              />

            </div>
          `
          : `
            <div
              style="
                display:grid;
                place-items:center;
                aspect-ratio:4 / 3;
                margin-bottom:12px;
                border:1px solid var(--line);
                border-radius:calc(
                  var(--radius) - 4px
                );
                background:
                  rgba(255,255,255,.018);
                color:var(--muted);
                font-family:
                  Georgia,
                  'Times New Roman',
                  serif;
                font-size:2rem;
              "
              aria-hidden="true"
            >
              ◇
            </div>
          `
      }


      <span class="eyebrow">
        ${
          escapeHtml(
            titleCaseStatus(
              asset.category ||
              "asset"
            )
          )
        }
      </span>


      <h3
        style="
          margin:
            5px 0 6px;
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          font-size:1rem;
          font-weight:400;
        "
      >
        ${
          escapeHtml(
            asset.name ||
            "Untitled Asset"
          )
        }
      </h3>


      ${
        asset.description
          ? `
            <p
              style="
                margin:
                  0 0 10px;
                color:var(--muted);
                font-size:.74rem;
                line-height:1.55;
              "
            >
              ${
                escapeHtml(
                  truncateText(
                    asset.description,
                    160
                  )
                )
              }
            </p>
          `
          : ""
      }


      <div
        style="
          display:flex;
          gap:7px;
          flex-wrap:wrap;
          margin-top:9px;
        "
      >

        ${
          asset.approvedForAi
            ? `
              <span
                style="
                  display:inline-flex;
                  align-items:center;
                  min-height:22px;
                  padding:3px 7px;
                  border:1px solid var(--line);
                  border-radius:999px;
                  color:var(--muted);
                  font-size:.62rem;
                  text-transform:uppercase;
                  letter-spacing:.04em;
                "
              >
                AI Approved
              </span>
            `
            : ""
        }


        ${
          asset.approvedForMarketing
            ? `
              <span
                style="
                  display:inline-flex;
                  align-items:center;
                  min-height:22px;
                  padding:3px 7px;
                  border:1px solid var(--line);
                  border-radius:999px;
                  color:var(--muted);
                  font-size:.62rem;
                  text-transform:uppercase;
                  letter-spacing:.04em;
                "
              >
                Marketing Approved
              </span>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================================================
   ASSET FILTERS
   ========================================================= */

function setAssetFilter(
  filter
) {
  $$(
    "[data-asset-filter]"
  ).forEach(
    button => {
      button.classList.toggle(
        "is-active",
        button.dataset
          .assetFilter ===
          filter
      );
    }
  );


  renderAssets();
}


/* =========================================================
ASSET EDITOR
========================================================= */

function ensureAssetEditorDialog() {
let dialog =
$("#assetEditorDialog");


if (dialog) {
return dialog;
}


dialog =
document.createElement(
"dialog"
);


dialog.id =
"assetEditorDialog";


dialog.className =
"app-dialog";


dialog.innerHTML = `
<div class="asset-editor-shell">

<div class="dialog-header">

<div>
<span class="eyebrow">
Asset Vault
</span>

<h2 id="assetEditorTitle">
Edit Asset
</h2>
</div>

<button
id="closeAssetEditorButton"
class="dialog-close"
type="button"
aria-label="Close asset editor"
>
×
</button>

</div>


<div class="asset-editor-body">

<div
id="assetEditorPreview"
class="asset-editor-preview"
></div>


<form
id="assetEditorForm"
class="create-form"
style="padding:0;"
>

<input
id="assetEditorId"
type="hidden"
/>


<label class="field">

<span>
Name
</span>

<input
id="assetEditorName"
type="text"
maxlength="160"
required
/>

</label>


<label class="field">

<span>
Type
</span>

<select
id="assetEditorCategory"
>

<option value="logo">
Logo
</option>

<option value="photo">
Photo
</option>

<option value="generated_artwork">
Generated Artwork
</option>

<option value="brand_asset">
Brand Asset
</option>

</select>

</label>


<label class="field">

<span>
Folder
</span>

<select
id="assetEditorFolder"
>
<option value="">
Asset Vault Root
</option>
</select>

</label>


<label class="field">

<span>
Description
</span>

<textarea
id="assetEditorDescription"
style="min-height:120px;"
></textarea>

</label>


<label class="field">

<span>
Alt Text
</span>

<input
id="assetEditorAltText"
type="text"
/>

</label>


<label class="field">

<span>
Tags
</span>

<input
id="assetEditorTags"
type="text"
placeholder="logo, coffee, social"
/>

</label>


<label
style="
display:flex;
align-items:center;
gap:10px;
"
>

<input
id="assetEditorApprovedAi"
type="checkbox"
/>

Approved for AI

</label>


<label
style="
display:flex;
align-items:center;
gap:10px;
"
>

<input
id="assetEditorApprovedMarketing"
type="checkbox"
/>

Approved for Marketing

</label>


<label
style="
display:flex;
align-items:center;
gap:10px;
"
>

<input
id="assetEditorActive"
type="checkbox"
/>

Active

</label>


<div class="asset-editor-actions">

<button
id="deleteAssetEditorButton"
class="danger-button"
type="button"
>
Delete Asset
</button>

<button
id="cancelAssetEditorButton"
class="secondary-button"
type="button"
>
Cancel
</button>

<button
id="saveAssetEditorButton"
class="primary-button"
type="submit"
>
Save Changes
</button>

</div>

</form>

</div>

</div>
`;


document.body.appendChild(
dialog
);


$("#closeAssetEditorButton")
?.addEventListener(
"click",
() => {
safeDialogClose(
dialog
);
}
);


$("#cancelAssetEditorButton")
?.addEventListener(
"click",
() => {
safeDialogClose(
dialog
);
}
);


$("#deleteAssetEditorButton")
?.addEventListener(
"click",
deleteAssetEditor
);


$("#assetEditorForm")
?.addEventListener(
"submit",
saveAssetEditor
);


enableBackdropClose(
dialog
);


return dialog;
}


function openAssetEditor(
assetId
) {
const asset =
APP_DATA.assets.find(
item =>
String(item.id) ===
String(assetId)
);


if (!asset) {
showToast(
"Asset could not be found.",
"error"
);

return;
}


const dialog =
ensureAssetEditorDialog();


$("#assetEditorId").value =
asset.id;


$("#assetEditorName").value =
asset.name || "";


$("#assetEditorCategory").value =
asset.category ||
"brand_asset";


const folderSelect =
$("#assetEditorFolder");


if (folderSelect) {
const brand =
getActiveBrand();

const folders =
(
APP_DATA.assetFolders ||
[]
)
.filter(
folder =>
!brand ||
String(
folder.brandId
) ===
String(
brand.id
)
)
.slice()
.sort(
(a, b) =>
folderName(a)
.localeCompare(
folderName(b)
)
);


folderSelect.innerHTML = `
<option value="">
Asset Vault Root
</option>

${
folders
.map(
folder => `
<option
value="${
escapeHtml(
folder.id
)
}"
>
${
escapeHtml(
folderName(
folder
)
)
}
</option>
`
)
.join("")
}
`;


folderSelect.value =
asset.folderId ||
"";
}


$("#assetEditorDescription").value =
asset.description || "";


$("#assetEditorAltText").value =
asset.altText || "";


$("#assetEditorTags").value =
Array.isArray(
asset.tags
)
? asset.tags.join(", ")
: "";


$("#assetEditorApprovedAi").checked =
Boolean(
asset.approvedForAi
);


$("#assetEditorApprovedMarketing").checked =
Boolean(
asset.approvedForMarketing
);


$("#assetEditorActive").checked =
asset.active !== false;


const title =
$("#assetEditorTitle");


if (title) {
title.textContent =
asset.name ||
"Edit Asset";
}


const preview =
$("#assetEditorPreview");


if (preview) {
const imageUrl =
getAssetDisplayUrl(
asset
);


const isImage =
asset.mimeType
?.startsWith(
"image/"
) ||
[
"logo",
"photo",
"generated_artwork",
"brand_asset"
].includes(
asset.category
);


if (
imageUrl &&
isImage
) {
preview.innerHTML = `
<img
src="${
escapeHtml(
imageUrl
)
}"
alt="${
escapeHtml(
asset.altText ||
asset.name ||
""
)
}"
/>
`;
} else {
preview.innerHTML = `
<div
style="
padding:32px 16px;
color:var(--muted);
text-align:center;
font-size:.8rem;
"
>
No image preview available.
</div>
`;
}
}


safeDialogOpen(
dialog
);
}


async function saveAssetEditor(
event
) {
event.preventDefault();


const id =
$("#assetEditorId")
?.value;


const name =
String(
$("#assetEditorName")
?.value ||
""
).trim();


const category =
$("#assetEditorCategory")
?.value ||
"brand_asset";


const folderId =
$("#assetEditorFolder")
?.value ||
null;


const description =
nullableText(
$("#assetEditorDescription")
?.value
);


const altText =
nullableText(
$("#assetEditorAltText")
?.value
);


const tags =
textToArray(
$("#assetEditorTags")
?.value
);


const approvedForAi =
Boolean(
$("#assetEditorApprovedAi")
?.checked
);


const approvedForMarketing =
Boolean(
$("#assetEditorApprovedMarketing")
?.checked
);


const active =
Boolean(
$("#assetEditorActive")
?.checked
);


if (!id) {
showToast(
"Asset ID is missing.",
"error"
);

return;
}


if (!name) {
showToast(
"Give this asset a name.",
"error"
);

return;
}


const button =
$("#saveAssetEditorButton");


if (button) {
button.disabled =
true;

button.textContent =
"Saving…";
}


try {
const {
error
} =
await supabaseClient
.from("assets")
.update({
name,

asset_type:
category,

folder_id:
folderId,

description,

alt_text:
altText,

tags,

approved_for_ai:
approvedForAi,

approved_for_marketing:
approvedForMarketing,

active
})
.eq(
"id",
id
);


if (error) {
throw error;
}


const asset =
APP_DATA.assets.find(
item =>
String(item.id) ===
String(id)
);


if (asset) {
asset.name =
name;

asset.category =
category;

asset.folderId =
folderId;

asset.description =
description;

asset.altText =
altText;

asset.tags =
tags;

asset.approvedForAi =
approvedForAi;

asset.approvedForMarketing =
approvedForMarketing;

asset.active =
active;
}


safeDialogClose(
$("#assetEditorDialog")
);


renderApp();


showToast(
"Asset updated.",
"success"
);

} catch (error) {
console.error(
"Asset update failed:",
error
);


showToast(
error?.message ||
"Asset could not be updated.",
"error"
);

} finally {
if (button) {
button.disabled =
false;

button.textContent =
"Save Changes";
}
}
}


async function deleteAssetEditor() {
  const id =
    $("#assetEditorId")
      ?.value;


  if (!id) {
    showToast(
      "Asset ID is missing.",
      "error"
    );

    return;
  }


  const asset =
    APP_DATA.assets.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!asset) {
    showToast(
      "Asset could not be found.",
      "error"
    );

    return;
  }


  const confirmed =
    window.confirm(
      `Permanently delete "${asset.name || "this asset"}"?\n\nThis cannot be undone.`
    );


  if (!confirmed) {
    return;
  }


  const button =
    $("#deleteAssetEditorButton");


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Deleting…";
  }


  try {

    /*
     * First delete the database record.
     */
    const {
      error:
        databaseError
    } =
      await supabaseClient
        .from("assets")
        .delete()
        .eq(
          "id",
          id
        );


    if (databaseError) {
      throw databaseError;
    }


    /*
     * If this asset was uploaded into
     * Supabase Storage, remove the
     * underlying file as well.
     *
     * Failure here does not restore the
     * database record. It is logged so a
     * stray storage object can be cleaned
     * manually if necessary.
     */
    if (
      asset.storageBucket &&
      asset.storagePath
    ) {
      const {
        error:
          storageError
      } =
        await supabaseClient
          .storage
          .from(
            asset.storageBucket
          )
          .remove([
            asset.storagePath
          ]);


      if (storageError) {
        console.warn(
          "Asset record deleted, but storage cleanup failed:",
          storageError
        );
      }
    }


    APP_DATA.assets =
      APP_DATA.assets.filter(
        item =>
          String(item.id) !==
          String(id)
      );


    safeDialogClose(
      $("#assetEditorDialog")
    );


    renderApp();


    showToast(
      "Asset deleted.",
      "success"
    );

  } catch (error) {
    console.error(
      "Asset deletion failed:",
      error
    );


    showToast(
      error?.message ||
      "Asset could not be deleted.",
      "error"
    );

  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        "Delete Asset";
    }
  }
}
  

/* =========================================================
   ASSET FOLDERS
   ========================================================= */

function getAssetFoldersForActiveBrand() {
  const brand =
    getActiveBrand();

  if (!brand) {
    return [];
  }

  return (
    APP_DATA.assetFolders || []
  )
    .filter(
      folder =>
        String(folder.brandId) ===
        String(brand.id)
    )
    .sort(
      (a, b) =>
        String(folderName(a))
          .localeCompare(
            String(folderName(b))
          )
    );
}


/* =========================================================
   ASSET FOLDER NAME
   ========================================================= */

function folderName(folder) {
  return (
    folder?.name ||
    "Untitled Folder"
  );
}


/* =========================================================
   ASSET COUNT FOR FOLDER
   ========================================================= */

function getAssetFolderAssetCount(
  folderId
) {
  return APP_DATA.assets.filter(
    asset =>
      String(
        asset.folderId || ""
      ) ===
      String(folderId)
  ).length;
}


/* =========================================================
   RENDER ASSET FOLDER CARD
   ========================================================= */

function renderAssetFolderCard(
  folder
) {
  const assetCount =
    getAssetFolderAssetCount(
      folder.id
    );

  return `
    <article
      class="content-panel"
      data-open-asset-folder="${
        escapeHtml(folder.id)
      }"
      role="button"
      tabindex="0"
      style="
        min-width:0;
        cursor:pointer;
        position:relative;
      "
    >

      <button
        type="button"
        data-delete-asset-folder="${
          escapeHtml(folder.id)
        }"
        aria-label="Delete ${
          escapeHtml(
            folderName(folder)
          )
        }"
        title="Delete Folder"
        style="
          position:absolute;
          top:12px;
          right:12px;
          z-index:5;

          display:grid;
          place-items:center;

          width:34px;
          height:34px;

          padding:0;

          border:
            1px solid
            rgba(163,95,95,.28);

          border-radius:10px;

          color:
            var(--danger);

          background:
            rgba(8,10,9,.82);

          font-size:1rem;
          line-height:1;
        "
      >
        ×
      </button>

      <div
        style="
          min-height:145px;
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          gap:20px;
        "
      >

        <div
          aria-hidden="true"
          style="
            font-size:2.1rem;
            line-height:1;
          "
        >
          ◇
        </div>

        <div>
          <span class="eyebrow">
            Folder
          </span>

          <h3
            style="
              margin:6px 0 4px;
              padding-right:36px;
            "
          >
            ${
              escapeHtml(
                folderName(folder)
              )
            }
          </h3>

          <p
            style="
              margin:0;
              color:var(--muted);
              font-size:.75rem;
            "
          >
            ${assetCount}
            ${
              assetCount === 1
                ? "asset"
                : "assets"
            }
          </p>
        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   OPEN ASSET FOLDER
   ========================================================= */

function openAssetFolderById(
  folderId
) {
  const folder =
    APP_DATA.assetFolders.find(
      item =>
        String(item.id) ===
        String(folderId)
    );

  if (!folder) {
    showToast(
      "Asset folder could not be found.",
      "error"
    );

    return;
  }

  APP_STATE.activeAssetFolderId =
    folder.id;

  renderApp();
}


/* =========================================================
   RENAME ASSET FOLDER
   ========================================================= */

async function renameAssetFolder(
  folderId
) {
  const folder =
    (APP_DATA.assetFolders || []).find(
      item =>
        String(item.id) ===
        String(folderId)
    );

  if (!folder) {
    showToast(
      "Asset folder could not be found.",
      "error"
    );
    return;
  }

  const currentName =
    folderName(folder);

  const requestedName =
    window.prompt(
      "Rename folder:",
      currentName
    );

  if (requestedName === null) {
    return;
  }

  const name =
    String(requestedName).trim();

  if (!name) {
    showToast(
      "Folder name cannot be empty.",
      "error"
    );
    return;
  }

  if (name === currentName) {
    return;
  }

  try {
    const { data, error } =
      await supabaseClient
        .from("asset_folders")
        .update({ name })
        .eq("id", folder.id)
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    const updatedFolder =
      normalizeAssetFolder(data);

    APP_DATA.assetFolders =
      (APP_DATA.assetFolders || []).map(
        item =>
          String(item.id) ===
          String(folder.id)
            ? updatedFolder
            : item
      );

    renderApp();

    showToast(
      "Folder renamed.",
      "success"
    );
  } catch (error) {
    console.error(
      "Folder rename failed:",
      error
    );

    showToast(
      error?.message ||
        "Folder could not be renamed.",
      "error",
      5500
    );
  }
}


/* =========================================================
   DELETE ASSET FOLDER
   ========================================================= */

async function deleteAssetFolder(
  folderId
) {
  const folder =
    (
      APP_DATA.assetFolders ||
      []
    ).find(
      item =>
        String(item.id) ===
        String(folderId)
    );

  if (!folder) {
    showToast(
      "Asset folder could not be found.",
      "error"
    );

    return;
  }


  const assetCount =
    getAssetFolderAssetCount(
      folder.id
    );


  /*
   * Do not delete folders containing
   * assets. This keeps deletion safe
   * and prevents orphaned records.
   */
  if (assetCount > 0) {
    showToast(
      `${
        folderName(folder)
      } contains ${
        assetCount
      } ${
        assetCount === 1
          ? "asset"
          : "assets"
      }. Move or delete ${
        assetCount === 1
          ? "it"
          : "them"
      } first.`,
      "error",
      5500
    );

    return;
  }


  /*
   * Also protect against deleting a
   * parent folder containing folders.
   * This matters if nested folders are
   * enabled later.
   */
  const childFolders =
    (
      APP_DATA.assetFolders ||
      []
    ).filter(
      item =>
        String(
          item.parentFolderId ||
          ""
        ) ===
        String(folder.id)
    );


  if (childFolders.length) {
    showToast(
      `${
        folderName(folder)
      } contains ${
        childFolders.length
      } ${
        childFolders.length === 1
          ? "folder"
          : "folders"
      }. Delete or move ${
        childFolders.length === 1
          ? "it"
          : "them"
      } first.`,
      "error",
      5500
    );

    return;
  }


  const confirmed =
    window.confirm(
      `Permanently delete "${folderName(
        folder
      )}"?\n\nThis cannot be undone.`
    );


  if (!confirmed) {
    return;
  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from(
          "asset_folders"
        )
        .delete()
        .eq(
          "id",
          folder.id
        );


    if (error) {
      throw error;
    }


    /*
     * Remove the deleted folder from
     * local application state.
     */
    APP_DATA.assetFolders =
      (
        APP_DATA.assetFolders ||
        []
      ).filter(
        item =>
          String(item.id) !==
          String(folder.id)
      );


    /*
     * If the user somehow deletes the
     * folder currently being viewed,
     * return to the parent/root.
     */
    if (
      String(
        APP_STATE.activeAssetFolderId ||
        ""
      ) ===
      String(folder.id)
    ) {
      APP_STATE.activeAssetFolderId =
        folder.parentFolderId ||
        null;
    }


    renderApp();


    showToast(
      "Folder deleted.",
      "success"
    );

  } catch (error) {

    console.error(
      "Folder deletion failed:",
      error
    );


    showToast(
      error?.message ||
      "Folder could not be deleted.",
      "error",
      5500
    );
  }
}


/* =========================================================
   CREATE ASSET FOLDER DIALOG
   ========================================================= */

function openCreateAssetFolderDialog() {
  const brand =
    getActiveBrand();

  if (!brand) {
    showToast(
      "Choose a working brand first.",
      "error"
    );

    return;
  }

  let dialog =
    $("#assetFolderDialog");

  if (!dialog) {
    dialog =
      document.createElement(
        "dialog"
      );

    dialog.id =
      "assetFolderDialog";

    dialog.className =
      "app-dialog";

    document.body.appendChild(
      dialog
    );
  }

  dialog.innerHTML = `
    <div
      class="dialog-shell"
      style="
        width:min(
          520px,
          calc(100vw - 28px)
        );
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:20px;
          margin-bottom:22px;
        "
      >
        <div>
          <span class="eyebrow">
            Asset Vault
          </span>

          <h2
            style="
              margin:5px 0;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-weight:400;
            "
          >
            Create Folder
          </h2>

          <p
            style="
              margin:0;
              color:var(--muted);
              font-size:.78rem;
            "
          >
            Organize assets for
            ${escapeHtml(
              brand.name
            )}.
          </p>
        </div>

        <button
          type="button"
          class="icon-button"
          data-close-asset-folder
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form
        id="assetFolderForm"
        autocomplete="off"
      >
        <label>
          <span>
            Folder Name
          </span>

          <input
            id="assetFolderName"
            type="text"
            maxlength="120"
            placeholder="Campaign Photography"
            required
          />
        </label>

        <div
          style="
            display:flex;
            justify-content:flex-end;
            gap:10px;
            margin-top:22px;
          "
        >
          <button
            type="button"
            class="secondary-button"
            data-close-asset-folder
          >
            Cancel
          </button>

          <button
            id="saveAssetFolderButton"
            type="submit"
            class="primary-button"
          >
            Create Folder
          </button>
        </div>
      </form>
    </div>
  `;

  $("#assetFolderForm")
    ?.addEventListener(
      "submit",
      handleCreateAssetFolder
    );

  safeDialogOpen(
    dialog
  );

  requestAnimationFrame(
    () => {
      $("#assetFolderName")
        ?.focus();
    }
  );
}


/* =========================================================
   CREATE ASSET FOLDER
   ========================================================= */

async function handleCreateAssetFolder(
  event
) {
  event.preventDefault();

  const brand =
    getActiveBrand();

  if (!brand) {
    return;
  }

  const name =
    String(
      $("#assetFolderName")
        ?.value ||
      ""
    ).trim();

  if (!name) {
    showToast(
      "Give the folder a name.",
      "error"
    );

    return;
  }

  const button =
    $("#saveAssetFolderButton");

  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Creating…";
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "asset_folders"
        )
        .insert({
          brand_id:
            brand.id,

          parent_folder_id:
            APP_STATE.activeAssetFolderId ||
            null,

          name
        })
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    APP_DATA.assetFolders.push(
      normalizeAssetFolder(
        data
      )
    );

    safeDialogClose(
      $("#assetFolderDialog")
    );

    renderApp();

    showToast(
      "Folder created.",
      "success"
    );

  } catch (error) {
    console.error(
      "Folder creation failed:",
      error
    );

    showToast(
      error?.message ||
      "Folder could not be created.",
      "error"
    );

  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        "Create Folder";
    }
  }
}
/* =========================================================
   ASSET UPLOAD
   ========================================================= */

function handleAddAsset() {
  const brand =
    getActiveBrand();

  if (!brand) {
    showToast(
      "Choose a working brand first.",
      "error"
    );

    return;
  }

  openAssetUploadDialog();
}


/* =========================================================
   ASSET UPLOAD DIALOG
   ========================================================= */

function openAssetUploadDialog() {
  const brand =
    getActiveBrand();

  if (!brand) {
    showToast(
      "Choose a working brand first.",
      "error"
    );

    return;
  }


  let dialog =
    $("#assetUploadDialog");


  if (!dialog) {
    dialog =
      document.createElement(
        "dialog"
      );

    dialog.id =
      "assetUploadDialog";

    dialog.className =
      "app-dialog";

    document.body.appendChild(
      dialog
    );
  }


  dialog.innerHTML = `
    <div
      class="dialog-shell"
      style="
        width:min(620px, calc(100vw - 28px));
        max-height:min(820px, calc(100vh - 28px));
        overflow:auto;
      "
    >

      <div
        style="
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:20px;
          margin-bottom:22px;
        "
      >

        <div>
          <span class="eyebrow">
            Asset Vault
          </span>

          <h2
            style="
              margin:5px 0 5px;
              font-family:
                Georgia,
                'Times New Roman',
                serif;
              font-weight:400;
            "
          >
            Add Asset
          </h2>

          <p
            style="
              margin:0;
              color:var(--muted);
              font-size:.78rem;
              line-height:1.55;
            "
          >
            Add a reusable asset to
            ${escapeHtml(
              brand.name
            )}.
          </p>
        </div>


        <button
          type="button"
          class="icon-button"
          data-close-asset-upload
          aria-label="Close asset upload"
        >
          ×
        </button>

      </div>


      <form
        id="assetUploadForm"
        autocomplete="off"
      >

        <div class="form-grid">


          <label
            style="
              grid-column:1 / -1;
            "
          >
            <span>
              File
            </span>

            <input
              id="assetUploadFile"
              name="assetFile"
              type="file"
              required
              accept="
                image/*,
                application/pdf,
                .svg
              "
            />
          </label>


          <label>
            <span>
              Asset Name
            </span>

            <input
              id="assetUploadName"
              name="assetName"
              type="text"
              maxlength="160"
              placeholder="Primary Logo"
              required
            />
          </label>


          <label>
            <span>
              Type
            </span>

            <select
              id="assetUploadCategory"
              name="assetCategory"
              required
            >
              <option value="logo">
                Logo
              </option>

              <option value="photo">
                Photo
              </option>

              <option value="generated_artwork">
                Generated Artwork
              </option>

              <option value="brand_asset">
                Brand Asset
              </option>

              <option value="other">
                Other
              </option>
            </select>
          </label>


          <label
            style="
              grid-column:1 / -1;
            "
          >
            <span>
              Description
            </span>

            <textarea
              id="assetUploadDescription"
              name="assetDescription"
              rows="3"
              placeholder="What this asset is and when it should be used."
            ></textarea>
          </label>


          <label
            style="
              grid-column:1 / -1;
            "
          >
            <span>
              Alt Text
            </span>

            <input
              id="assetUploadAltText"
              name="assetAltText"
              type="text"
              maxlength="300"
              placeholder="Describe the image for accessibility."
            />
          </label>


          <label
            style="
              grid-column:1 / -1;
            "
          >
            <span>
              Tags
            </span>

            <input
              id="assetUploadTags"
              name="assetTags"
              type="text"
              placeholder="logo, primary, dark background"
            />

            <small
              style="
                display:block;
                margin-top:5px;
                color:var(--muted);
                font-size:.68rem;
              "
            >
              Separate tags with commas.
            </small>
          </label>


          <label
            style="
              display:flex;
              align-items:center;
              gap:9px;
              cursor:pointer;
            "
          >
            <input
              id="assetApprovedForAi"
              name="approvedForAi"
              type="checkbox"
            />

            <span>
              Approved for AI
            </span>
          </label>


          <label
            style="
              display:flex;
              align-items:center;
              gap:9px;
              cursor:pointer;
            "
          >
            <input
              id="assetApprovedForMarketing"
              name="approvedForMarketing"
              type="checkbox"
            />

            <span>
              Approved for Marketing
            </span>
          </label>

        </div>


        <div
          style="
            display:flex;
            justify-content:flex-end;
            gap:10px;
            margin-top:24px;
          "
        >

          <button
            type="button"
            class="secondary-button"
            data-close-asset-upload
          >
            Cancel
          </button>

          <button
            id="assetUploadSubmitButton"
            type="submit"
            class="primary-button"
          >
            Upload Asset
          </button>

        </div>
      </form>

    </div>
  `;


  dialog
    .querySelectorAll(
      "[data-close-asset-upload]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            safeDialogClose(
              dialog
            );
          }
        );
      }
    );


  dialog
    .querySelector(
      "#assetUploadFile"
    )
    ?.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        const nameField =
          dialog.querySelector(
            "#assetUploadName"
          );

        if (
          file &&
          nameField &&
          !nameField.value.trim()
        ) {
          nameField.value =
            file.name
              .replace(
                /\.[^.]+$/,
                ""
              )
              .replace(
                /[-_]+/g,
                " "
              )
              .replace(
                /\s+/g,
                " "
              )
              .trim();
        }
      }
    );


  dialog
    .querySelector(
      "#assetUploadForm"
    )
    ?.addEventListener(
      "submit",
      handleAssetUploadSubmit
    );


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
    },
    {
      once: true
    }
  );


  safeDialogOpen(
    dialog
  );
}


/* =========================================================
   ASSET FILE HELPERS
   ========================================================= */

function sanitizeAssetFileName(
  fileName
) {
  const original =
    String(
      fileName ||
      "asset"
    );


  const extensionMatch =
    original.match(
      /\.([a-zA-Z0-9]+)$/
    );


  const extension =
    extensionMatch
      ? `.${extensionMatch[1]
          .toLowerCase()}`
      : "";


  const base =
    original
      .replace(
        /\.[^.]+$/,
        ""
      )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      ) ||
    "asset";


  return `${base}${extension}`;
}


function createAssetStoragePath(
  file,
  brand
) {
  const userId =
    APP_STATE.user?.id;


  if (!userId) {
    throw new Error(
      "Your authenticated user could not be identified."
    );
  }


  const safeFileName =
    sanitizeAssetFileName(
      file.name
    );


  const brandSlug =
    makeSlug(
      brand.slug ||
      brand.shortName ||
      brand.name ||
      brand.id
    ) ||
    "brand";


  const uniquePart =
    (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    )
      ? window.crypto
          .randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;


  return [
    userId,
    brandSlug,
    uniquePart,
    safeFileName
  ].join("/");
}


/* =========================================================
   ASSET UPLOAD SUBMIT
   ========================================================= */

async function handleAssetUploadSubmit(
  event
) {
  event.preventDefault();


  const dialog =
    $("#assetUploadDialog");


  const form =
    event.currentTarget;


  const brand =
    getActiveBrand();


  if (
    !dialog ||
    !form ||
    !brand
  ) {
    showToast(
      "Asset upload could not start.",
      "error"
    );

    return;
  }


  const file =
    $("#assetUploadFile", dialog)
      ?.files?.[0];


  const name =
    $("#assetUploadName", dialog)
      ?.value
      ?.trim();


  const category =
    $("#assetUploadCategory", dialog)
      ?.value ||
    "other";


  const description =
    nullableText(
      $("#assetUploadDescription", dialog)
        ?.value
    );


  const altText =
    nullableText(
      $("#assetUploadAltText", dialog)
        ?.value
    );


  const tags =
    textToArray(
      $("#assetUploadTags", dialog)
        ?.value
    );


  const approvedForAi =
    Boolean(
      $("#assetApprovedForAi", dialog)
        ?.checked
    );


  const approvedForMarketing =
    Boolean(
      $("#assetApprovedForMarketing", dialog)
        ?.checked
    );


  if (!file) {
    showToast(
      "Choose a file to upload.",
      "error"
    );

    return;
  }


  if (!name) {
    showToast(
      "Give the asset a name.",
      "error"
    );

    return;
  }


  if (!APP_STATE.user?.id) {
    showToast(
      "Your login session is unavailable.",
      "error"
    );

    return;
  }


  const submitButton =
    $("#assetUploadSubmitButton", dialog);


  if (submitButton) {
    submitButton.disabled =
      true;

    submitButton.textContent =
      "Uploading…";
  }


  let storagePath =
    null;


  const storageBucket =
    "brand-assets";


  try {

    storagePath =
      createAssetStoragePath(
        file,
        brand
      );


    const {
      error: uploadError
    } =
      await supabaseClient
        .storage
        .from(
          storageBucket
        )
        .upload(
          storagePath,
          file,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              file.type ||
              undefined
          }
        );


    if (uploadError) {
      throw uploadError;
    }


    const payload = {
      brand_id:
        brand.id,

      folder_id:
        APP_STATE.activeAssetFolderId ||
        null,

      name,

      asset_type:
        category,

      description,

      storage_bucket:
        storageBucket,

      storage_path:
        storagePath,

      external_url:
        null,

      mime_type:
        file.type ||
        null,

      alt_text:
        altText,

      tags,

      approved_for_ai:
        approvedForAi,

      approved_for_marketing:
        approvedForMarketing,

      active:
        true
    };


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "assets"
        )
        .insert(
          payload
        )
        .select(
          "*"
        )
        .single();


    if (error) {
      throw error;
    }


    const normalized =
      normalizeAsset(
        data
      );

    await hydrateAssetSignedUrls(
      [normalized]
    );


    APP_DATA.assets.unshift(
      normalized
    );


    safeDialogClose(
      dialog
    );


    renderAssets();


    showToast(
      `${name} added to the Asset Vault.`,
      "success"
    );

  } catch (error) {

    console.error(
      "Asset upload failed:",
      error
    );


    /*
      If the Storage upload worked but the
      database insert failed, remove the
      orphaned Storage object.
    */

    if (storagePath) {
      try {
        await supabaseClient
          .storage
          .from(
            storageBucket
          )
          .remove([
            storagePath
          ]);
      } catch (
        cleanupError
      ) {
        console.warn(
          "Unable to clean up failed asset upload:",
          cleanupError
        );
      }
    }


    showToast(
      error?.message ||
      "The asset could not be uploaded.",
      "error",
      6000
    );

  } finally {

    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        "Upload Asset";
    }
  }
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


  const currentValue =
    select.value;


  select.innerHTML =
    APP_DATA.brands
      .filter(
        brand =>
          brand.active !== false
      )
      .map(
        brand => `
          <option
            value="${
              escapeHtml(
                brand.id
              )
            }"
          >
            ${
              escapeHtml(
                brand.name
              )
            }
          </option>
        `
      )
      .join("");


  const activeBrand =
    getActiveBrand();


  const desiredValue =
    (
      currentValue &&
      APP_DATA.brands.some(
        brand =>
          brand.id ===
          currentValue
      )
    )
      ? currentValue
      : activeBrand?.id;


  if (desiredValue) {
    select.value =
      desiredValue;
  }
}


/* =========================================================
   QUICK CREATE
   ========================================================= */

function openQuickCreate(
  type = "social-post"
) {
  const dialog =
    $("#quickCreateDialog");


  if (!dialog) {
    showToast(
      "Quick Create is unavailable.",
      "error"
    );

    return;
  }


  const normalizedType =
    CREATE_TYPES[type]
      ? type
      : "social-post";


  const definition =
    CREATE_TYPES[
      normalizedType
    ];


  const typeField =
    $("#createContentType");


  const title =
    $("#quickCreateDialogTitle");


  const promptField =
    $("#createPrompt");
      if (typeField) {
    typeField.value =
      normalizedType;
  }

  if (title) {
    title.textContent =
      `Create ${definition.label}`;
  }

  renderQuickCreateBrandOptions();

  const activeBrand =
    getActiveBrand();

  if (
    activeBrand &&
    $("#createBrand")
  ) {
    $("#createBrand").value =
      activeBrand.id;
  }

  if (promptField) {
    promptField.value =
      "";
  }

  const goalField =
    $("#createGoal");

  if (goalField) {
    goalField.selectedIndex =
      0;
  }

  safeDialogOpen(
    dialog
  );

  window.setTimeout(
    () => {
      promptField?.focus();
    },
    100
  );
}


/* =========================================================
   QUICK CREATE TYPE → DATABASE TYPE
   ========================================================= */

function getDatabaseContentType(
  appType
) {
  const map = {
    "social-post":
      "social_post",

    story:
      "story",

    reel:
      "reel_script",

    email:
      "email",

    "website-copy":
      "website_copy",

    graphic:
      "promotional_graphic",

    campaign:
      "campaign"
  };

  return (
    map[appType] ||
    "other"
  );
}


/* =========================================================
   QUICK CREATE SUBMISSION
   ========================================================= */

async function handleQuickCreateSubmit(
  event
) {
  event.preventDefault();

  const type =
    $("#createContentType")
      ?.value ||
    "social-post";

  const brandId =
    $("#createBrand")
      ?.value;

  const request =
    $("#createPrompt")
      ?.value
      ?.trim();

  const goal =
    $("#createGoal")
      ?.value ||
    "";

  if (!brandId) {
    showToast(
      "Choose a brand.",
      "error"
    );

    return;
  }

  if (!request) {
    showToast(
      "Tell Marketing Studio what you want to create.",
      "error"
    );

    $("#createPrompt")
      ?.focus();

    return;
  }

  const brand =
    APP_DATA.brands.find(
      item =>
        item.id ===
        brandId
    );

  if (!brand) {
    showToast(
      "That brand could not be found.",
      "error"
    );

    return;
  }

  setActiveBrand(
    brand.id,
    {
      toast:
        false
    }
  );

  const brief =
    buildAiBrief({
      brand,
      type,
      request,
      goal
    });

  safeDialogClose(
    $("#quickCreateDialog")
  );

  showManualAiDialog({
    brand,
    type,
    request,
    goal,
    brief
  });
}


/* =========================================================
   BRAND FACT ELIGIBILITY
   ========================================================= */

function brandFactCanEnterAiBrief(
  fact
) {
  if (!fact) {
    return false;
  }

  if (
    fact.active ===
    false
  ) {
    return false;
  }

  if (
    fact.is_sensitive
  ) {
    return false;
  }

  if (
    fact.status ===
      "archived"
  ) {
    return false;
  }

  return (
    fact.status ===
      "verified" ||
    fact.status ===
      "owner_approved"
  );
}


/* =========================================================
   FORMAT BRAND FACT FOR AI
   ========================================================= */

function formatBrandFactForBrief(
  fact
) {
  if (!fact) {
    return "";
  }

  const label =
    fact.subject ||
    fact.fact_key ||
    fact.category ||
    "Brand fact";

  let value =
    fact.value_text;

  if (
    !value &&
    fact.value_jsonb != null
  ) {
    try {
      value =
        JSON.stringify(
          fact.value_jsonb
        );
    } catch {
      value =
        String(
          fact.value_jsonb
        );
    }
  }

  if (!value) {
    return "";
  }

  return (
    `- ${label}: ${value}`
  );
}


/* =========================================================
   FORMAT ARRAY FOR AI
   ========================================================= */

function formatArrayForBrief(
  values
) {
  if (
    !Array.isArray(
      values
    ) ||
    !values.length
  ) {
    return "";
  }

  return values
    .filter(Boolean)
    .join(", ");
}


/* =========================================================
   BUILD BRAND IDENTITY SECTION
   ========================================================= */

function buildBrandIdentityBrief(
  brand
) {
  const lines = [];

  lines.push(
    `Official name: ${brand.name}`
  );

  if (brand.shortName) {
    lines.push(
      `Short name: ${brand.shortName}`
    );
  }

  if (brand.website) {
    lines.push(
      `Website: ${brand.website}`
    );
  }

  if (brand.businessType) {
    lines.push(
      `Business type: ${brand.businessType}`
    );
  }

  if (brand.stage) {
    lines.push(
      `Business stage: ${brand.stageLabel || brand.stage}`
    );
  }

  if (brand.primaryGoal) {
    lines.push(
      `Primary marketing goal: ${brand.primaryGoal}`
    );
  }

  if (brand.campaignPhase) {
    lines.push(
      `Current campaign phase: ${brand.campaignPhase}`
    );
  }

  if (brand.tagline) {
    lines.push(
      `Tagline: ${brand.tagline}`
    );
  }

  if (brand.shortDescription) {
    lines.push(
      `Short description: ${brand.shortDescription}`
    );
  }

  if (brand.longDescription) {
    lines.push(
      `Long description: ${brand.longDescription}`
    );
  }

  if (brand.brandStory) {
    lines.push(
      `Brand story: ${brand.brandStory}`
    );
  }

  if (brand.mission) {
    lines.push(
      `Mission: ${brand.mission}`
    );
  }

  if (brand.differentiator) {
    lines.push(
      `Differentiator: ${brand.differentiator}`
    );
  }

  if (brand.brandPromise) {
    lines.push(
      `Brand promise: ${brand.brandPromise}`
    );
  }

  if (brand.openingDate) {
    lines.push(
      brand.openingDateConfirmed
        ? `Confirmed opening date: ${brand.openingDate}`
        : `Unconfirmed possible opening date: ${brand.openingDate}`
    );
  }

  return lines.join(
    "\n"
  );
}


/* =========================================================
   BUILD BRAND VOICE SECTION
   ========================================================= */

function buildBrandVoiceBrief(
  brand
) {
  const voice =
    brand.voice ||
    {};

  const lines = [];

  const adjectives =
    formatArrayForBrief(
      voice.adjectives
    );

  if (adjectives) {
    lines.push(
      `Voice adjectives: ${adjectives}`
    );
  }

  if (
    voice.emotionalAtmosphere
  ) {
    lines.push(
      `Emotional atmosphere: ${voice.emotionalAtmosphere}`
    );
  }

  if (voice.formality) {
    lines.push(
      `Formality: ${voice.formality}`
    );
  }

  if (voice.humorStyle) {
    lines.push(
      `Humor style: ${voice.humorStyle}`
    );
  }

  if (voice.mysteryLevel) {
    lines.push(
      `Mystery level: ${voice.mysteryLevel}`
    );
  }

  const preferredVocabulary =
    formatArrayForBrief(
      voice.preferredVocabulary
    );

  if (preferredVocabulary) {
    lines.push(
      `Preferred vocabulary: ${preferredVocabulary}`
    );
  }

  const avoidVocabulary =
    formatArrayForBrief(
      voice.avoidVocabulary
    );

  if (avoidVocabulary) {
    lines.push(
      `Vocabulary to avoid: ${avoidVocabulary}`
    );
  }

  const preferredPhrases =
    formatArrayForBrief(
      voice.preferredPhrases
    );

  if (preferredPhrases) {
    lines.push(
      `Preferred phrases: ${preferredPhrases}`
    );
  }

  const avoidPhrases =
    formatArrayForBrief(
      voice.avoidPhrases
    );

  if (avoidPhrases) {
    lines.push(
      `Phrases to avoid: ${avoidPhrases}`
    );
  }

  const cliches =
    formatArrayForBrief(
      voice.clichesToAvoid
    );

  if (cliches) {
    lines.push(
      `Clichés to avoid: ${cliches}`
    );
  }

  if (voice.emojiPolicy) {
    lines.push(
      `Emoji policy: ${voice.emojiPolicy}`
    );
  }

  if (voice.profanityPolicy) {
    lines.push(
      `Profanity policy: ${voice.profanityPolicy}`
    );
  }

  if (
    voice.capitalizationStyle
  ) {
    lines.push(
      `Capitalization style: ${voice.capitalizationStyle}`
    );
  }

  if (voice.ctaStyle) {
    lines.push(
      `Call-to-action style: ${voice.ctaStyle}`
    );
  }

  if (voice.writingNotes) {
    lines.push(
      `Additional writing notes: ${voice.writingNotes}`
    );
  }

  if (
    Array.isArray(
      voice.approvedExamples
    ) &&
    voice.approvedExamples.length
  ) {
    lines.push(
      "Approved examples of on-brand language:"
    );

    voice.approvedExamples
      .forEach(
        example => {
          lines.push(
            `- ${example}`
          );
        }
      );
  }

  return lines.join(
    "\n"
  );
}


/* =========================================================
   BUILD SOURCE OF TRUTH SECTION
   ========================================================= */

function buildBrandFactsBrief(
  brand
) {
  const facts =
    Array.isArray(
      brand.facts
    )
      ? brand.facts
          .filter(
            brandFactCanEnterAiBrief
          )
      : [];

  if (!facts.length) {
    return (
      "- No verified or owner-approved Source of Truth facts are currently stored. Do not invent missing business facts."
    );
  }

  return facts
    .map(
      formatBrandFactForBrief
    )
    .filter(Boolean)
    .join("\n");
}


/* =========================================================
   BUILD AI GUARDRAILS SECTION
   ========================================================= */

function buildBrandRulesBrief(
  brand
) {
  const rules =
    Array.isArray(
      brand.rules
    )
      ? brand.rules
          .filter(
            rule =>
              rule.active !==
              false
          )
          .slice()
          .sort(
            (a, b) =>
              Number(
                a.priority || 100
              ) -
              Number(
                b.priority || 100
              )
          )
      : [];

  if (!rules.length) {
    return (
      "- Do not invent facts, prices, dates, offers, availability, policies, products, services, or business claims."
    );
  }

  return rules
    .map(
      rule =>
        `- [Priority ${
          Number(
            rule.priority ||
            100
          )
        }] ${rule.rule_text}`
    )
    .join("\n");
}


/* =========================================================
   BUILD MILESTONE SECTION
   ========================================================= */

function buildBrandMilestonesBrief(
  brand
) {
  const milestones =
    Array.isArray(
      brand.milestones
    )
      ? brand.milestones
      : [];

  const useful =
    milestones
      .filter(
        milestone =>
          milestone.status ===
            "completed" ||
          milestone.status ===
            "in_progress"
      )
      .slice()
      .sort(
        (a, b) => {
          const aDate =
            new Date(
              a.completed_at ||
              a.milestone_date ||
              0
            ).getTime();

          const bDate =
            new Date(
              b.completed_at ||
              b.milestone_date ||
              0
            ).getTime();

          return bDate - aDate;
        }
      )
      .slice(
        0,
        12
      );

  if (!useful.length) {
    return (
      "- No completed or in-progress milestones are stored."
    );
  }

  return useful
    .map(
      milestone => {
        const parts = [
          milestone.title
        ];

        if (
          milestone.status
        ) {
          parts.push(
            `status: ${
              titleCaseStatus(
                milestone.status
              )
            }`
          );
        }

        if (
          milestone.milestone_date
        ) {
          parts.push(
            `date: ${
              milestone.milestone_date
            }`
          );
        }

        if (
          milestone.description
        ) {
          parts.push(
            milestone.description
          );
        }

        return (
          `- ${parts.join(" — ")}`
        );
      }
    )
    .join("\n");
}


/* =========================================================
   CONTENT TYPE INSTRUCTIONS
   ========================================================= */

function getAiContentInstructions(
  type
) {
  switch (type) {
    case "social-post":
      return [
        "Write one polished social media post.",
        "Use natural paragraphing.",
        "Include a call to action only when appropriate.",
        "Do not add hashtags unless they genuinely help.",
        "Do not fabricate urgency or scarcity."
      ];

    case "story":
      return [
        "Create concise social Story copy.",
        "Break the idea into short, readable frames when useful.",
        "Keep each frame visually scannable.",
        "Include a final action or response prompt only when appropriate."
      ];

    case "reel":
      return [
        "Create a short-form video or Reel script.",
        "Include a strong opening hook without clickbait.",
        "Separate spoken copy from visual or shot direction.",
        "Keep the concept practical to film."
      ];

    case "email":
      return [
        "Write a complete marketing email.",
        "Include a subject line.",
        "Include preview text when useful.",
        "Keep the body readable and purposeful.",
        "Include a clear call to action when appropriate."
      ];

    case "website-copy":
      return [
        "Write polished website copy.",
        "Use useful headings and concise sections.",
        "Prioritize clarity before cleverness.",
        "Do not invent claims, credentials, pricing, policies, or availability."
      ];

    case "graphic":
      return [
        "Create copy and art direction for a promotional graphic.",
        "Keep on-image copy concise.",
        "Separate visible text from visual direction.",
        "Describe composition, mood, imagery, and typography without inventing business facts."
      ];

    case "campaign":
      return [
        "Build a practical marketing campaign concept.",
        "Include the campaign idea, objective, audience, message, content opportunities, and call to action.",
        "Use only confirmed business information.",
        "Do not invent promotions, discounts, launch dates, or availability."
      ];

    default:
      return [
        "Create polished marketing content that follows the brand information and guardrails below."
      ];
  }
}


/* =========================================================
   BUILD COMPLETE AI BRIEF
   ========================================================= */

function buildAiBrief({
  brand,
  type,
  request,
  goal
}) {
  const definition =
    CREATE_TYPES[type];

  const contentLabel =
    definition?.label ||
    getContentTypeLabel(
      type
    );

  const contentInstructions =
    getAiContentInstructions(
      type
    );

  const sections = [];

  sections.push(
`BLACK STAG MARKETING STUDIO
CONTENT BRIEF

You are helping create marketing content for a real business.

Your job is to produce useful, polished copy while obeying the Brand Brain below.

IMPORTANT:
- Treat verified and owner-approved information as factual.
- Do not turn AI suggestions, guesses, or missing information into facts.
- Do not invent prices, dates, operating hours, products, services, promotions, availability, policies, addresses, claims, credentials, events, or business status.
- If the request depends on information that is not confirmed below, write around the missing detail or clearly flag what needs confirmation.
- Follow the AI Guardrails even when they conflict with the creative request.
- Preserve the brand's established voice without exaggerating it.`
  );

  sections.push(
`CONTENT REQUEST

Type: ${contentLabel}

Goal: ${
  goal ||
  "Not specified"
}

Owner request:
${request}`
  );

  sections.push(
`OUTPUT INSTRUCTIONS

${
  contentInstructions
    .map(
      instruction =>
        `- ${instruction}`
    )
    .join("\n")
}

Return the finished content first.

After the finished content, include a short section titled:
NOTES FOR OWNER

Only use that section for:
- factual details that still need confirmation,
- optional creative alternatives,
- or a brief explanation of an important choice.

Do not pad the response with generic marketing advice.`
  );

  sections.push(
`BRAND IDENTITY

${buildBrandIdentityBrief(
  brand
)}`
  );

  sections.push(
`BRAND VOICE

${
  buildBrandVoiceBrief(
    brand
  ) ||
  "No detailed Brand Voice has been stored yet. Use the identity and guardrails conservatively."
}`
  );

  sections.push(
`SOURCE OF TRUTH

${buildBrandFactsBrief(
  brand
)}`
  );

  sections.push(
`AI GUARDRAILS

${buildBrandRulesBrief(
  brand
)}`
  );

  sections.push(
`CURRENT BUSINESS PROGRESS

${buildBrandMilestonesBrief(
  brand
)}`
  );

  return sections
    .join(
      "\n\n========================================\n\n"
    );
}


/* =========================================================
   MANUAL AI WORKFLOW STATE
   ========================================================= */

const MANUAL_AI_STATE = {
  brandId: null,
  type: null,
  request: "",
  goal: "",
  brief: ""
};


/* =========================================================
   MANUAL AI DIALOG
   ========================================================= */

function ensureManualAiDialog() {
  let dialog =
    $("#manualAiDialog");

  if (dialog) {
    return dialog;
  }

  dialog =
    document.createElement(
      "dialog"
    );

  dialog.id =
    "manualAiDialog";

  dialog.className =
    "app-dialog create-dialog";

  dialog.innerHTML = `
    <div
      style="
        width:min(860px,94vw);
        max-width:100%;
        max-height:92vh;
        overflow-y:auto;
      "
    >

      <div class="dialog-header">

        <div>
          <span class="eyebrow">
            AI Studio
          </span>

          <h2 id="manualAiDialogTitle">
            Create with ChatGPT
          </h2>
        </div>

        <button
          id="closeManualAiDialogButton"
          class="dialog-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>

      <div
        style="
          display:grid;
          gap:18px;
        "
      >

        <section>

          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              gap:12px;
              flex-wrap:wrap;
              margin-bottom:10px;
            "
          >

            <div>
              <span class="eyebrow">
                Step One
              </span>

              <h3
                style="
                  margin:4px 0 0;
                  font-family:
                    Georgia,
                    'Times New Roman',
                    serif;
                  font-size:1rem;
                  font-weight:400;
                "
              >
                Copy the AI brief
              </h3>
            </div>

            <button
              id="copyAiBriefButton"
              class="secondary-button"
              type="button"
            >
              Copy Brief
            </button>

          </div>

          <textarea
            id="manualAiBrief"
            readonly
            style="
              min-height:250px;
              font-family:
                ui-monospace,
                SFMono-Regular,
                Menlo,
                Monaco,
                Consolas,
                monospace;
              font-size:.72rem;
              line-height:1.55;
            "
          ></textarea>

          <p
            style="
              margin:8px 0 0;
              color:var(--muted);
              font-size:.72rem;
              line-height:1.55;
            "
          >
            Paste this into ChatGPT. The brief already
            contains the current Brand Brain, verified
            facts, voice rules, milestones, and AI
            guardrails.
          </p>

        </section>

        <section
          style="
            padding-top:18px;
            border-top:1px solid var(--line);
          "
        >

          <div
            style="
              margin-bottom:10px;
            "
          >
            <span class="eyebrow">
              Step Two
            </span>

            <h3
              style="
                margin:4px 0 0;
                font-family:
                  Georgia,
                  'Times New Roman',
                  serif;
                font-size:1rem;
                font-weight:400;
              "
            >
              Paste the finished result
            </h3>
          </div>

          <textarea
            id="manualAiResult"
            style="
              min-height:240px;
            "
            placeholder="Paste ChatGPT's finished content here."
          ></textarea>

        </section>

        <section
          style="
            padding-top:18px;
            border-top:1px solid var(--line);
          "
        >
          <span class="eyebrow">
            Draft Details
          </span>

          <div
            style="
              margin-top:10px;
            "
          >

            ${brandBrainGridOpen()}

              <label class="field">
                <span>
                  Title
                </span>

                <input
                  id="manualAiDraftTitle"
                  type="text"
                  placeholder="Give this draft a useful name"
                />
              </label>

              <label class="field">
                <span>
                  Platform
                </span>

                <input
                  id="manualAiPlatform"
                  type="text"
                  placeholder="Instagram, Facebook, Website…"
                />
              </label>

            </div>
          </div>

        </section>

        <div class="form-actions">

          <button
            id="cancelManualAiButton"
            class="secondary-button"
            type="button"
          >
            Cancel
          </button>

          <button
            id="saveManualAiDraftButton"
            class="primary-button"
            type="button"
          >
            Save Draft
          </button>

        </div>

      </div>
    </div>
  `;

  document.body.appendChild(
    dialog
  );

  $("#closeManualAiDialogButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          dialog
        );
      }
    );

  $("#cancelManualAiButton")
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
      copyManualAiBrief
    );

  $("#saveManualAiDraftButton")
    ?.addEventListener(
      "click",
      saveManualAiDraft
    );

  enableBackdropClose(
    dialog
  );

  return dialog;
}


/* =========================================================
   SHOW MANUAL AI WORKFLOW
   ========================================================= */

function showManualAiDialog({
  brand,
  type,
  request,
  goal,
  brief
}) {
  const dialog =
    ensureManualAiDialog();

  MANUAL_AI_STATE.brandId =
    brand.id;

  MANUAL_AI_STATE.type =
    type;

  MANUAL_AI_STATE.request =
    request;

  MANUAL_AI_STATE.goal =
    goal;

  MANUAL_AI_STATE.brief =
    brief;

  const definition =
    CREATE_TYPES[type];

  const title =
    $("#manualAiDialogTitle");

  if (title) {
    title.textContent =
      `Create ${
        definition?.label ||
        "Content"
      }`;
  }

  const briefField =
    $("#manualAiBrief");

  if (briefField) {
    briefField.value =
      brief;
  }

  const resultField =
    $("#manualAiResult");

  if (resultField) {
    resultField.value =
      "";
  }

  const draftTitle =
    $("#manualAiDraftTitle");

  if (draftTitle) {
    draftTitle.value =
      buildDefaultDraftTitle(
        type,
        request
      );
  }

  const platform =
    $("#manualAiPlatform");

  if (platform) {
    platform.value =
      getDefaultPlatformForType(
        type
      );
  }

  safeDialogOpen(
    dialog
  );

  window.setTimeout(
    () => {
      $("#copyAiBriefButton")
        ?.focus();
    },
    100
  );
}


/* =========================================================
   DEFAULT DRAFT TITLE
   ========================================================= */

function buildDefaultDraftTitle(
  type,
  request
) {
  const definition =
    CREATE_TYPES[type];

  const label =
    definition?.label ||
    "Content";

  const cleanRequest =
    String(
      request ||
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!cleanRequest) {
    return label;
  }

  return (
    `${label} — ${
      truncateText(
        cleanRequest,
        60
      )
    }`
  );
}


/* =========================================================
   DEFAULT PLATFORM
   ========================================================= */

function getDefaultPlatformForType(
  type
) {
  switch (type) {
    case "social-post":
      return "Social";

    case "story":
      return "Social Story";

    case "reel":
      return "Reel / Short Video";

    case "email":
      return "Email";

    case "website-copy":
      return "Website";

    case "graphic":
      return "Promotional Graphic";

    case "campaign":
      return "Multi-channel";

    default:
      return "";
  }
}


/* =========================================================
   COPY AI BRIEF
   ========================================================= */

async function copyManualAiBrief() {
  const brief =
    $("#manualAiBrief")
      ?.value ||
    MANUAL_AI_STATE.brief;

  if (!brief) {
    showToast(
      "There is no AI brief to copy.",
      "error"
    );

    return;
  }

  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard
        .writeText(
          brief
        );
    } else {
      const field =
        $("#manualAiBrief");

      field?.focus();
      field?.select();

      const copied =
        document.execCommand(
          "copy"
        );

      if (!copied) {
        throw new Error(
          "Clipboard access was unavailable."
        );
      }
    }

    showToast(
      "AI brief copied. Paste it into ChatGPT.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to copy AI brief:",
      error
    );

    showToast(
      "Could not copy automatically. Select the brief and copy it manually.",
      "error",
      5000
    );
  }
}


/* =========================================================
   SAVE MANUAL AI DRAFT
   ========================================================= */

async function saveManualAiDraft() {
  const brandId =
    MANUAL_AI_STATE.brandId;

  const type =
    MANUAL_AI_STATE.type;

  const request =
    MANUAL_AI_STATE.request;

  const goal =
    MANUAL_AI_STATE.goal;

  const brief =
    MANUAL_AI_STATE.brief;

  const result =
    $("#manualAiResult")
      ?.value
      ?.trim();

  const title =
    $("#manualAiDraftTitle")
      ?.value
      ?.trim();

  const platform =
    $("#manualAiPlatform")
      ?.value
      ?.trim();

  if (!brandId) {
    showToast(
      "The working brand is missing.",
      "error"
    );

    return;
  }

  if (!result) {
    showToast(
      "Paste the finished ChatGPT result before saving.",
      "error"
    );

    $("#manualAiResult")
      ?.focus();

    return;
  }

  const button =
    $("#saveManualAiDraftButton");

  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Saving…";
  }

  try {
    if (
      type === "campaign"
    ) {
      await saveManualCampaignDraft({
        brandId,
        request,
        goal,
        brief,
        result,
        title,
        platform
      });
    } else {
      await saveManualContentDraft({
        brandId,
        type,
        request,
        goal,
        brief,
        result,
        title,
        platform
      });
    }

    safeDialogClose(
      $("#manualAiDialog")
    );

    clearManualAiState();

    await refreshWorkingData();

    renderDashboard();
    renderCampaigns();
    renderContentLibrary();
    renderCalendar();
    renderAssets();

    showToast(
      "Draft saved.",
      "success"
    );

  } catch (error) {
    console.error(
      "Unable to save manual AI draft:",
      error
    );

    showToast(
      error?.message ||
      "Unable to save the draft.",
      "error",
      5000
    );

  } finally {
    const currentButton =
      $("#saveManualAiDraftButton");

    if (currentButton) {
      currentButton.disabled =
        false;

      currentButton.textContent =
        "Save Draft";
    }
  }
}


/* =========================================================
   SAVE CONTENT DRAFT
   ========================================================= */

async function saveManualContentDraft({
  brandId,
  type,
  request,
  goal,
  brief,
  result,
  title,
  platform
}) {
  const payload = {
    brand_id:
      brandId,

    content_type:
      getDatabaseContentType(
        type
      ),

    title:
      nullableText(
        title
      ) ||
      getContentTypeLabel(
        type
      ),

    body:
      result,

    platform:
      nullableText(
        platform
      ),

    status:
      "draft",

    goal:
      nullableText(
        goal
      ),

    original_request:
      nullableText(
        request
      ),

    ai_mode:
      "manual-chatgpt",

    ai_brief:
      nullableText(
        brief
      )
  };

  console.log(
    "Saving content draft:",
    payload
  );

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
    console.error(
      "Content draft insert failed:",
      error
    );

    throw error;
  }

  if (!data?.id) {
    throw new Error(
      "The draft insert completed without returning a saved content item."
    );
  }

  console.log(
    "Content draft saved:",
    data
  );

  await logManualAiRun({
    brandId,
    request,
    brief,
    result,
    contentType:
      getDatabaseContentType(
        type
      )
  });

  return data;
}


/* =========================================================
   SAVE CAMPAIGN DRAFT
   ========================================================= */

async function saveManualCampaignDraft({
  brandId,
  request,
  goal,
  brief,
  result,
  title,
  platform
}) {
  const campaignName =
    nullableText(
      title
    ) ||
    "AI Campaign Draft";

  const channels =
    platform
      ? textToArray(
          platform
        )
      : [];

  const payload = {
    brand_id:
      brandId,

    name:
      campaignName,

    description:
      result,

    objective:
      nullableText(
        goal
      ) ||
      nullableText(
        request
      ),

    status:
      "draft",

    channels:
      channels
  };

  const {
    error
  } =
    await supabaseClient
      .from(
        "campaigns"
      )
      .insert(
        payload
      );

  if (error) {
    throw error;
  }

  await logManualAiRun({
    brandId,
    request,
    brief,
    result,
    contentType:
      "campaign"
  });
}


/* =========================================================
   AI RUN LOG
   ========================================================= */

async function logManualAiRun({
  brandId,
  request,
  brief,
  result,
  contentType
}) {
  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "ai_runs"
        )
        .insert({
          brand_id:
            brandId,

          provider:
            "manual-chatgpt",

          mode:
            "manual",

          task_type:
            contentType,

          user_request:
            request,

          prompt_text:
            brief,

          response_text:
            result,

          status:
            "completed"
        });

    if (error) {
      console.warn(
        "AI run log was not saved:",
        error
      );
    }

  } catch (error) {
    console.warn(
      "AI run logging failed:",
      error
    );
  }
}


/* =========================================================
   CLEAR MANUAL AI STATE
   ========================================================= */

function clearManualAiState() {
  MANUAL_AI_STATE.brandId =
    null;

  MANUAL_AI_STATE.type =
    null;

  MANUAL_AI_STATE.request =
    "";

  MANUAL_AI_STATE.goal =
    "";

  MANUAL_AI_STATE.brief =
    "";
}


/* =========================================================
   REFRESH WORKING DATA
   ========================================================= */

async function refreshWorkingData() {
  const activeBrandId =
    APP_STATE.activeBrandId;

  await loadAppData();

  if (
    activeBrandId &&
    APP_DATA.brands.some(
      brand =>
        brand.id ===
        activeBrandId
    )
  ) {
    APP_STATE.activeBrandId =
      activeBrandId;
  }

  renderActiveBrand();
  renderBrandPicker();
  renderBrandGrid();
  renderQuickCreateBrandOptions();
  syncQuickCreateBrand();
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function navigateToView(
  viewName
) {
  const targetView =
    VIEW_DEFINITIONS[
      viewName
    ]
      ? viewName
      : "dashboard";

  APP_STATE.activeView =
    targetView;

  writeStorage(
    STORAGE_KEYS.lastView,
    targetView
  );

  $$(
    "[data-view-panel]"
  ).forEach(
    panel => {
      panel.hidden =
        panel.dataset
          .viewPanel !==
        targetView;
    }
  );

  $$(
    "[data-view]"
  ).forEach(
    button => {
      const active =
        button.dataset
          .view ===
        targetView;

      button.classList.toggle(
        "is-active",
        active
      );

      if (active) {
        button.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        button.removeAttribute(
          "aria-current"
        );
      }
    }
  );

  renderCurrentView();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   RENDER CURRENT VIEW
   ========================================================= */

function renderCurrentView() {
  switch (
    APP_STATE.activeView
  ) {
    case "dashboard":
      renderDashboard();
      break;

    case "brands":
      renderBrandGrid();
      break;

    case "campaigns":
      renderCampaigns();
      break;

    case "studio":
      renderContentLibrary();
      break;

    case "calendar":
      renderCalendar();
      break;

    case "vault":
      renderAssets();
      break;

    case "settings":
      break;

    default:
      renderDashboard();
  }
}


/* =========================================================
   RENDER EVERYTHING
   ========================================================= */

function renderApp() {
  renderActiveBrand();
  renderBrandPicker();
  renderBrandGrid();
  renderDashboard();
  renderCampaigns();
  renderContentLibrary();
  renderCalendar();
  renderAssets();
  renderQuickCreateBrandOptions();
  renderCurrentView();
}


/* =========================================================
   BRAND SWITCHER
   ========================================================= */

function openBrandPicker() {
  const dialog =
    $("#brandPickerDialog");

  if (!dialog) {
    return;
  }

  renderBrandPicker();

  safeDialogOpen(
    dialog
  );
}


/* =========================================================
   ADD BRAND PLACEHOLDER
   ========================================================= */

function handleAddBrand() {
  showToast(
    "Brand creation is next on the build list. Your three starter brands are already connected.",
    "success",
    4500
  );
}


/* =========================================================
   SETTINGS
   ========================================================= */

const STUDIO_SETTINGS_KEY =
  "black-stag-studio-settings-v1";


const DEFAULT_STUDIO_SETTINGS = {
  ai: {
    creativity:
      "balanced",

    brandBrainRequired:
      true,

    preferVaultAssets:
      true,

    approvedAssetsOnly:
      true,

    generateAltText:
      true,

    generateCaptions:
      true,

    defaultImageFormat:
      "square",

    requireGeneratedApproval:
      true
  },

  social: {
    facebookEnabled:
      false,

    instagramEnabled:
      false,

    linkedinEnabled:
      false,

    pinterestEnabled:
      false,

    tiktokEnabled:
      false
  },

  publishing: {
    requireApproval:
      true,

    confirmBeforePublish:
      true,

    allowDirectPublish:
      false,

    defaultStatus:
      "draft",

    defaultSchedule:
      "manual",

    includeBrandName:
      false
  },

  preferences: {
    defaultView:
      "dashboard",

    confirmDeletes:
      true,

    showSuccessToasts:
      true,

    compactCards:
      false,

    reduceMotion:
      false,

    rememberLastBrand:
      true
  }
};


function cloneDefaultStudioSettings() {
  return JSON.parse(
    JSON.stringify(
      DEFAULT_STUDIO_SETTINGS
    )
  );
}


function mergeStudioSettings(
  saved = {}
) {
  const defaults =
    cloneDefaultStudioSettings();

  return {
    ai: {
      ...defaults.ai,
      ...(saved.ai || {})
    },

    social: {
      ...defaults.social,
      ...(saved.social || {})
    },

    publishing: {
      ...defaults.publishing,
      ...(saved.publishing || {})
    },

    preferences: {
      ...defaults.preferences,
      ...(saved.preferences || {})
    }
  };
}


function loadStudioSettings() {
  try {
    const saved =
      localStorage.getItem(
        STUDIO_SETTINGS_KEY
      );

    if (!saved) {
      return mergeStudioSettings();
    }

    return mergeStudioSettings(
      JSON.parse(saved)
    );

  } catch (error) {
    console.warn(
      "Could not load studio settings:",
      error
    );

    return mergeStudioSettings();
  }
}


let STUDIO_SETTINGS =
  loadStudioSettings();


function saveStudioSettings() {
  try {
    localStorage.setItem(
      STUDIO_SETTINGS_KEY,
      JSON.stringify(
        STUDIO_SETTINGS
      )
    );

    applyStudioSettings();

    return true;

  } catch (error) {
    console.error(
      "Could not save studio settings:",
      error
    );

    showToast(
      "Settings could not be saved.",
      "error"
    );

    return false;
  }
}


/* =========================================================
   SETTINGS — HELPERS
   ========================================================= */

function settingToggle({
  id,
  title,
  description,
  checked = false
}) {
  return `
    <label
      style="
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:18px;
        padding:16px 0;
        border-bottom:1px solid var(--line);
        cursor:pointer;
      "
    >
      <span
        style="
          display:flex;
          flex-direction:column;
          gap:4px;
          min-width:0;
        "
      >
        <strong
          style="
            font-size:.84rem;
            font-weight:650;
          "
        >
          ${escapeHtml(title)}
        </strong>

        <small
          style="
            color:var(--muted);
            font-size:.7rem;
            line-height:1.5;
          "
        >
          ${escapeHtml(description)}
        </small>
      </span>

      <input
        id="${escapeHtml(id)}"
        type="checkbox"
        ${checked ? "checked" : ""}
        style="
          flex:0 0 auto;
          width:20px;
          height:20px;
          margin-top:2px;
          accent-color:var(--forest-bright);
        "
      />
    </label>
  `;
}


function settingsDialogShell({
  eyebrow = "Configuration",
  title,
  description,
  content
}) {
  return `
    <div
      style="
        width:100%;
        max-width:720px;
        margin:0 auto;
      "
    >
      <div class="dialog-header">

        <div>
          <span class="eyebrow">
            ${escapeHtml(eyebrow)}
          </span>

          <h2>
            ${escapeHtml(title)}
          </h2>

          ${
            description
              ? `
                <p
                  style="
                    margin:7px 0 0;
                    color:var(--muted);
                    font-size:.76rem;
                    line-height:1.55;
                  "
                >
                  ${escapeHtml(description)}
                </p>
              `
              : ""
          }
        </div>

        <button
          type="button"
          class="dialog-close"
          data-close-settings-dialog
          aria-label="Close settings"
        >
          ×
        </button>

      </div>

      ${content}
    </div>
  `;
}


function getSettingsDialog() {
  let dialog =
    $("#studioSettingsDialog");

  if (!dialog) {
    dialog =
      document.createElement(
        "dialog"
      );

    dialog.id =
      "studioSettingsDialog";

    dialog.className =
      "app-dialog create-dialog";

    document.body.appendChild(
      dialog
    );

    enableBackdropClose(
      dialog
    );
  }

  return dialog;
}


function bindSettingsDialogClose(
  dialog
) {
  dialog
    .querySelectorAll(
      "[data-close-settings-dialog]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            safeDialogClose(
              dialog
            );
          }
        );
      }
    );
}


/* =========================================================
   SETTINGS — MAIN ROUTER
   ========================================================= */

function handleSettingsSection(
  section
) {
  switch (section) {

    case "ai":
      openAiSettings();
      break;

    case "social":
      openSocialSettings();
      break;

    case "publishing":
      openPublishingSettings();
      break;

    case "preferences":
      openPreferenceSettings();
      break;

    default:
      showToast(
        "That settings section could not be found.",
        "error"
      );
  }
}


/* =========================================================
   AI SETTINGS
   ========================================================= */

function openAiSettings() {
  const dialog =
    getSettingsDialog();

  const settings =
    STUDIO_SETTINGS.ai;

  dialog.innerHTML =
    settingsDialogShell({
      title:
        "AI Settings",

      description:
        "Control how the studio uses Brand Brain, approved assets, and generation defaults.",

      content: `
        <form
          id="aiSettingsForm"
          class="create-form"
        >

          <label class="field">
            <span>
              Creativity
            </span>

            <select
              id="aiCreativity"
            >
              <option
                value="precise"
                ${
                  settings.creativity ===
                  "precise"
                    ? "selected"
                    : ""
                }
              >
                Precise
              </option>

              <option
                value="balanced"
                ${
                  settings.creativity ===
                  "balanced"
                    ? "selected"
                    : ""
                }
              >
                Balanced
              </option>

              <option
                value="exploratory"
                ${
                  settings.creativity ===
                  "exploratory"
                    ? "selected"
                    : ""
                }
              >
                Exploratory
              </option>
            </select>
          </label>


          <label class="field">
            <span>
              Default Image Format
            </span>

            <select
              id="aiDefaultImageFormat"
            >
              <option
                value="square"
                ${
                  settings.defaultImageFormat ===
                  "square"
                    ? "selected"
                    : ""
                }
              >
                Square
              </option>

              <option
                value="portrait"
                ${
                  settings.defaultImageFormat ===
                  "portrait"
                    ? "selected"
                    : ""
                }
              >
                Portrait
              </option>

              <option
                value="landscape"
                ${
                  settings.defaultImageFormat ===
                  "landscape"
                    ? "selected"
                    : ""
                }
              >
                Landscape
              </option>
            </select>
          </label>


          <div>
            ${settingToggle({
              id:
                "aiBrandBrainRequired",

              title:
                "Enforce Brand Brain",

              description:
                "Use the active brand's strategy, voice, audience, and identity when generating content.",

              checked:
                settings.brandBrainRequired
            })}

            ${settingToggle({
              id:
                "aiPreferVaultAssets",

              title:
                "Prefer Asset Vault",

              description:
                "Favor existing brand assets before requesting or generating new visuals.",

              checked:
                settings.preferVaultAssets
            })}

            ${settingToggle({
              id:
                "aiApprovedAssetsOnly",

              title:
                "AI-approved assets only",

              description:
                "Prevent AI workflows from using Vault assets that are not approved for AI.",

              checked:
                settings.approvedAssetsOnly
            })}

            ${settingToggle({
              id:
                "aiGenerateAltText",

              title:
                "Generate alt text",

              description:
                "Create accessibility descriptions for generated visual content.",

              checked:
                settings.generateAltText
            })}

            ${settingToggle({
              id:
                "aiGenerateCaptions",

              title:
                "Generate captions",

              description:
                "Prepare caption copy alongside generated marketing content.",

              checked:
                settings.generateCaptions
            })}

            ${settingToggle({
              id:
                "aiRequireGeneratedApproval",

              title:
                "Require generated-content approval",

              description:
                "Generated content must be reviewed before entering a publishing workflow.",

              checked:
                settings.requireGeneratedApproval
            })}
          </div>


          <div class="form-actions">

            <button
              type="button"
              class="secondary-button"
              data-close-settings-dialog
            >
              Cancel
            </button>

            <button
              type="submit"
              class="primary-button"
            >
              Save AI Settings
            </button>

          </div>

        </form>
      `
    });

  bindSettingsDialogClose(
    dialog
  );

  $("#aiSettingsForm")
    ?.addEventListener(
      "submit",
      saveAiSettings
    );

  safeDialogOpen(
    dialog
  );
}


function saveAiSettings(
  event
) {
  event.preventDefault();

  STUDIO_SETTINGS.ai = {
    creativity:
      $("#aiCreativity")
        ?.value ||
      "balanced",

    defaultImageFormat:
      $("#aiDefaultImageFormat")
        ?.value ||
      "square",

    brandBrainRequired:
      Boolean(
        $("#aiBrandBrainRequired")
          ?.checked
      ),

    preferVaultAssets:
      Boolean(
        $("#aiPreferVaultAssets")
          ?.checked
      ),

    approvedAssetsOnly:
      Boolean(
        $("#aiApprovedAssetsOnly")
          ?.checked
      ),

    generateAltText:
      Boolean(
        $("#aiGenerateAltText")
          ?.checked
      ),

    generateCaptions:
      Boolean(
        $("#aiGenerateCaptions")
          ?.checked
      ),

    requireGeneratedApproval:
      Boolean(
        $("#aiRequireGeneratedApproval")
          ?.checked
      )
  };

  if (!saveStudioSettings()) {
    return;
  }

  safeDialogClose(
    $("#studioSettingsDialog")
  );

  showToast(
    "AI settings saved.",
    "success"
  );
}


/* =========================================================
   SOCIAL ACCOUNTS
   ========================================================= */

function openSocialSettings() {
  const dialog =
    getSettingsDialog();

  const settings =
    STUDIO_SETTINGS.social;

  dialog.innerHTML =
    settingsDialogShell({
      title:
        "Social Accounts",

      description:
        "Choose the publishing destinations the studio should prepare content for.",

      content: `
        <form
          id="socialSettingsForm"
          class="create-form"
        >

          <div>
            ${settingToggle({
              id:
                "socialFacebook",

              title:
                "Facebook",

              description:
                "Enable Facebook as an available publishing destination.",

              checked:
                settings.facebookEnabled
            })}

            ${settingToggle({
              id:
                "socialInstagram",

              title:
                "Instagram",

              description:
                "Enable Instagram as an available publishing destination.",

              checked:
                settings.instagramEnabled
            })}

            ${settingToggle({
              id:
                "socialLinkedIn",

              title:
                "LinkedIn",

              description:
                "Enable LinkedIn as an available publishing destination.",

              checked:
                settings.linkedinEnabled
            })}

            ${settingToggle({
              id:
                "socialPinterest",

              title:
                "Pinterest",

              description:
                "Enable Pinterest as an available publishing destination.",

              checked:
                settings.pinterestEnabled
            })}

            ${settingToggle({
              id:
                "socialTikTok",

              title:
                "TikTok",

              description:
                "Enable TikTok as an available publishing destination.",

              checked:
                settings.tiktokEnabled
            })}
          </div>


          <div
            class="content-panel"
            style="
              padding:16px;
            "
          >
            <span class="eyebrow">
              Connections
            </span>

            <p
              style="
                margin:6px 0 0;
                color:var(--muted);
                font-size:.74rem;
                line-height:1.55;
              "
            >
              These switches define available
              destinations. Account authorization
              will be connected separately when
              publishing APIs are wired.
            </p>
          </div>


          <div class="form-actions">

            <button
              type="button"
              class="secondary-button"
              data-close-settings-dialog
            >
              Cancel
            </button>

            <button
              type="submit"
              class="primary-button"
            >
              Save Accounts
            </button>

          </div>

        </form>
      `
    });

  bindSettingsDialogClose(
    dialog
  );

  $("#socialSettingsForm")
    ?.addEventListener(
      "submit",
      saveSocialSettings
    );

  safeDialogOpen(
    dialog
  );
}


function saveSocialSettings(
  event
) {
  event.preventDefault();

  STUDIO_SETTINGS.social = {
    facebookEnabled:
      Boolean(
        $("#socialFacebook")
          ?.checked
      ),

    instagramEnabled:
      Boolean(
        $("#socialInstagram")
          ?.checked
      ),

    linkedinEnabled:
      Boolean(
        $("#socialLinkedIn")
          ?.checked
      ),

    pinterestEnabled:
      Boolean(
        $("#socialPinterest")
          ?.checked
      ),

    tiktokEnabled:
      Boolean(
        $("#socialTikTok")
          ?.checked
      )
  };

  if (!saveStudioSettings()) {
    return;
  }

  safeDialogClose(
    $("#studioSettingsDialog")
  );

  showToast(
    "Social settings saved.",
    "success"
  );
}


/* =========================================================
   PUBLISHING SETTINGS
   ========================================================= */

function openPublishingSettings() {
  const dialog =
    getSettingsDialog();

  const settings =
    STUDIO_SETTINGS.publishing;

  dialog.innerHTML =
    settingsDialogShell({
      title:
        "Publishing",

      description:
        "Set the guardrails for drafts, approvals, scheduling, and direct publishing.",

      content: `
        <form
          id="publishingSettingsForm"
          class="create-form"
        >

          <label class="field">
            <span>
              Default Content Status
            </span>

            <select
              id="publishingDefaultStatus"
            >
              <option
                value="draft"
                ${
                  settings.defaultStatus ===
                  "draft"
                    ? "selected"
                    : ""
                }
              >
                Draft
              </option>

              <option
                value="review"
                ${
                  settings.defaultStatus ===
                  "review"
                    ? "selected"
                    : ""
                }
              >
                Ready for Review
              </option>
            </select>
          </label>


          <label class="field">
            <span>
              Default Scheduling
            </span>

            <select
              id="publishingDefaultSchedule"
            >
              <option
                value="manual"
                ${
                  settings.defaultSchedule ===
                  "manual"
                    ? "selected"
                    : ""
                }
              >
                Manual
              </option>

              <option
                value="next-slot"
                ${
                  settings.defaultSchedule ===
                  "next-slot"
                    ? "selected"
                    : ""
                }
              >
                Next Available Slot
              </option>
            </select>
          </label>


          <div>
            ${settingToggle({
              id:
                "publishingRequireApproval",

              title:
                "Require approval",

              description:
                "Content must be approved before it can be published.",

              checked:
                settings.requireApproval
            })}

            ${settingToggle({
              id:
                "publishingConfirmBeforePublish",

              title:
                "Confirm before publishing",

              description:
                "Show a final confirmation before content is sent live.",

              checked:
                settings.confirmBeforePublish
            })}

            ${settingToggle({
              id:
                "publishingAllowDirect",

              title:
                "Allow direct publishing",

              description:
                "Permit approved content to bypass scheduling and publish immediately.",

              checked:
                settings.allowDirectPublish
            })}

            ${settingToggle({
              id:
                "publishingIncludeBrandName",

              title:
                "Include brand name by default",

              description:
                "Prefer explicit brand identification in generated publishing copy.",

              checked:
                settings.includeBrandName
            })}
          </div>


          <div class="form-actions">

            <button
              type="button"
              class="secondary-button"
              data-close-settings-dialog
            >
              Cancel
            </button>

            <button
              type="submit"
              class="primary-button"
            >
              Save Publishing
            </button>

          </div>

        </form>
      `
    });

  bindSettingsDialogClose(
    dialog
  );

  $("#publishingSettingsForm")
    ?.addEventListener(
      "submit",
      savePublishingSettings
    );

  safeDialogOpen(
    dialog
  );
}


function savePublishingSettings(
  event
) {
  event.preventDefault();

  STUDIO_SETTINGS.publishing = {
    defaultStatus:
      $("#publishingDefaultStatus")
        ?.value ||
      "draft",

    defaultSchedule:
      $("#publishingDefaultSchedule")
        ?.value ||
      "manual",

    requireApproval:
      Boolean(
        $("#publishingRequireApproval")
          ?.checked
      ),

    confirmBeforePublish:
      Boolean(
        $("#publishingConfirmBeforePublish")
          ?.checked
      ),

    allowDirectPublish:
      Boolean(
        $("#publishingAllowDirect")
          ?.checked
      ),

    includeBrandName:
      Boolean(
        $("#publishingIncludeBrandName")
          ?.checked
      )
  };

  if (!saveStudioSettings()) {
    return;
  }

  safeDialogClose(
    $("#studioSettingsDialog")
  );

  showToast(
    "Publishing settings saved.",
    "success"
  );
}


/* =========================================================
   APP PREFERENCES
   ========================================================= */

function openPreferenceSettings() {
  const dialog =
    getSettingsDialog();

  const settings =
    STUDIO_SETTINGS.preferences;

  dialog.innerHTML =
    settingsDialogShell({
      title:
        "App Preferences",

      description:
        "Control everyday Studio behavior without changing individual brand data.",

      content: `
        <form
          id="preferenceSettingsForm"
          class="create-form"
        >

          <label class="field">
            <span>
              Default Landing View
            </span>

            <select
              id="preferenceDefaultView"
            >
              <option
                value="dashboard"
                ${
                  settings.defaultView ===
                  "dashboard"
                    ? "selected"
                    : ""
                }
              >
                Home
              </option>

              <option
                value="brands"
                ${
                  settings.defaultView ===
                  "brands"
                    ? "selected"
                    : ""
                }
              >
                Brands
              </option>

              <option
                value="studio"
                ${
                  settings.defaultView ===
                  "studio"
                    ? "selected"
                    : ""
                }
              >
                Studio
              </option>

              <option
                value="campaigns"
                ${
                  settings.defaultView ===
                  "campaigns"
                    ? "selected"
                    : ""
                }
              >
                Campaigns
              </option>

              <option
                value="calendar"
                ${
                  settings.defaultView ===
                  "calendar"
                    ? "selected"
                    : ""
                }
              >
                Calendar
              </option>

              <option
                value="assets"
                ${
                  settings.defaultView ===
                  "assets"
                    ? "selected"
                    : ""
                }
              >
                Asset Vault
              </option>
            </select>
          </label>


          <div>
            ${settingToggle({
              id:
                "preferenceConfirmDeletes",

              title:
                "Confirm destructive actions",

              description:
                "Ask for confirmation before deleting assets, folders, campaigns, or other records.",

              checked:
                settings.confirmDeletes
            })}

            ${settingToggle({
              id:
                "preferenceSuccessToasts",

              title:
                "Success notifications",

              description:
                "Show confirmation messages after successful actions.",

              checked:
                settings.showSuccessToasts
            })}

            ${settingToggle({
              id:
                "preferenceCompactCards",

              title:
                "Compact card layout",

              description:
                "Reduce spacing in grids to show more information at once.",

              checked:
                settings.compactCards
            })}

            ${settingToggle({
              id:
                "preferenceReduceMotion",

              title:
                "Reduce interface motion",

              description:
                "Minimize nonessential interface animation and transitions.",

              checked:
                settings.reduceMotion
            })}

            ${settingToggle({
              id:
                "preferenceRememberBrand",

              title:
                "Remember working brand",

              description:
                "Return to the most recently selected brand when reopening the Studio.",

              checked:
                settings.rememberLastBrand
            })}
          </div>


          <div class="form-actions">

            <button
              type="button"
              class="secondary-button"
              data-close-settings-dialog
            >
              Cancel
            </button>

            <button
              type="submit"
              class="primary-button"
            >
              Save Preferences
            </button>

          </div>

        </form>
      `
    });

  bindSettingsDialogClose(
    dialog
  );

  $("#preferenceSettingsForm")
    ?.addEventListener(
      "submit",
      savePreferenceSettings
    );

  safeDialogOpen(
    dialog
  );
}


function savePreferenceSettings(
  event
) {
  event.preventDefault();

  STUDIO_SETTINGS.preferences = {
    defaultView:
      $("#preferenceDefaultView")
        ?.value ||
      "dashboard",

    confirmDeletes:
      Boolean(
        $("#preferenceConfirmDeletes")
          ?.checked
      ),

    showSuccessToasts:
      Boolean(
        $("#preferenceSuccessToasts")
          ?.checked
      ),

    compactCards:
      Boolean(
        $("#preferenceCompactCards")
          ?.checked
      ),

    reduceMotion:
      Boolean(
        $("#preferenceReduceMotion")
          ?.checked
      ),

    rememberLastBrand:
      Boolean(
        $("#preferenceRememberBrand")
          ?.checked
      )
  };

  if (!saveStudioSettings()) {
    return;
  }

  safeDialogClose(
    $("#studioSettingsDialog")
  );

  showToast(
    "App preferences saved.",
    "success"
  );
}


/* =========================================================
   APPLY APP PREFERENCES
   ========================================================= */

function applyStudioSettings() {
  const preferences =
    STUDIO_SETTINGS.preferences;

  document.documentElement
    .classList.toggle(
      "studio-reduce-motion",
      Boolean(
        preferences.reduceMotion
      )
    );

  document.documentElement
    .classList.toggle(
      "studio-compact-cards",
      Boolean(
        preferences.compactCards
      )
    );
}


/*
 * Apply persisted preferences immediately.
 */
applyStudioSettings();


/* =========================================================
   BACKDROP CLOSE
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
        event.target !==
        dialog
      ) {
        return;
      }

      const rect =
        dialog.getBoundingClientRect();

      const inside =
        event.clientX >=
          rect.left &&
        event.clientX <=
          rect.right &&
        event.clientY >=
          rect.top &&
        event.clientY <=
          rect.bottom;

      if (!inside) {
        safeDialogClose(
          dialog
        );
      }
    }
  );
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer =
  null;

function showToast(
  message,
  type = "success",
  duration = 3200
) {
  const region =
    $("#toastRegion");

  if (!region) {
    console.log(
      message
    );

    return;
  }

  window.clearTimeout(
    toastTimer
  );

  region.textContent =
    message;

  region.classList.remove(
    "is-success",
    "is-error"
  );

  region.classList.add(
    type === "error"
      ? "is-error"
      : "is-success"
  );

  region.hidden =
    false;

  toastTimer =
    window.setTimeout(
      () => {
        region.hidden =
          true;

        region.classList.remove(
          "is-success",
          "is-error"
        );
      },
      duration
    );
}


/* =========================================================
   BRAND BRAIN DELEGATED ACTIONS
   ========================================================= */

function handleBrandBrainDelegatedClick(
  event
) {
  const closeButton =
    event.target.closest(
      "[data-close-brand-brain]"
    );

  if (closeButton) {
    closeBrandBrain();
    return;
  }

  const factTarget =
    event.target.closest(
      [
        "[data-add-brand-fact]",
        "[data-edit-brand-fact]",
        "[data-archive-brand-fact]"
      ].join(",")
    );

  if (factTarget) {
    handleBrandFactsClick(
      event
    );

    return;
  }

  const ruleTarget =
    event.target.closest(
      [
        "[data-add-brand-rule]",
        "[data-edit-brand-rule]",
        "[data-archive-brand-rule]"
      ].join(",")
    );

  if (ruleTarget) {
    handleBrandRulesClick(
      event
    );

    return;
  }

  const milestoneTarget =
    event.target.closest(
      [
        "[data-add-brand-milestone]",
        "[data-edit-brand-milestone]",
        "[data-complete-brand-milestone]",
        "[data-create-from-milestone]"
      ].join(",")
    );

  if (milestoneTarget) {
    handleBrandMilestonesClick(
      event
    );
  }
}


/* =========================================================
   GLOBAL CLICK HANDLING
   ========================================================= */

function handleGlobalClick(
  event
) {
  const navButton =
    event.target.closest(
      "[data-view]"
    );

  if (navButton) {
    navigateToView(
      navButton.dataset.view
    );

    return;
  }

  const createButton =
    event.target.closest(
      "[data-create-type]"
    );

  if (createButton) {
    const type =
      createButton.dataset
        .createType;

    openQuickCreate(
      type
    );

    return;
  }

  const brandSelect =
    event.target.closest(
      "[data-select-brand]"
    );

  if (brandSelect) {
    const brandId =
      brandSelect.dataset
        .selectBrand;

    setActiveBrand(
      brandId
    );

    safeDialogClose(
      $("#brandPickerDialog")
    );

    return;
  }

  const workWithBrand =
    event.target.closest(
      "[data-work-with-brand]"
    );

  if (workWithBrand) {
    const brandId =
      workWithBrand.dataset
        .workWithBrand;

    setActiveBrand(
      brandId
    );

    navigateToView(
      "dashboard"
    );

    return;
  }

  const brandBrainButton =
    event.target.closest(
      "[data-open-brand]"
    );

  if (brandBrainButton) {
    openBrandBrain(
      brandBrainButton.dataset
        .openBrand
    );

    return;
  }

  const approvedBrainImport =
    event.target.closest(
      "[data-import-approved-brand-brain]"
    );

  if (approvedBrainImport) {
    importApprovedBrandBrain(
      approvedBrainImport.dataset
        .importApprovedBrandBrain
    );

    return;
  }

  const campaignFilter =
    event.target.closest(
      "[data-campaign-filter]"
    );

  if (campaignFilter) {
    setCampaignFilter(
      campaignFilter.dataset
        .campaignFilter
    );

    return;
  }

  const contentCard =
    event.target.closest(
      "[data-open-content]"
    );

  if (contentCard) {
    openContentEditor(
      contentCard.dataset
        .openContent
    );

    return;
  }

  const calendarCard =
    event.target.closest(
      "[data-calendar-action]"
    );

  if (calendarCard) {
    const action =
      calendarCard.dataset
        .calendarAction;

    const itemId =
      calendarCard.dataset
        .calendarItemId;

    if (
      action === "content" &&
      itemId
    ) {
      openContentEditor(
        itemId
      );

      return;
    }
  }

  const contentFilter =
    event.target.closest(
      "[data-content-filter]"
    );

  if (contentFilter) {
    setContentFilter(
      contentFilter.dataset
        .contentFilter
    );

    return;
  }

  const assetCard =
    event.target.closest(
      "[data-open-asset]"
    );

  if (assetCard) {
    const assetId =
      assetCard.dataset
        .openAsset;

    if (assetId) {
      openAssetEditor(
        assetId
      );
    }

    return;
  }

  const assetFilter =
    event.target.closest(
      "[data-asset-filter]"
    );

  if (assetFilter) {
    setAssetFilter(
      assetFilter.dataset
        .assetFilter
    );

    return;
  }
  const renameAssetFolderButton =
  event.target.closest(
    "[data-rename-current-asset-folder]"
  );

if (renameAssetFolderButton) {
  event.preventDefault();
  event.stopPropagation();

  const folderId =
    renameAssetFolderButton.dataset
      .renameCurrentAssetFolder;

  if (folderId) {
    renameAssetFolder(
      folderId
    );
  }

  return;
}
const deleteAssetFolderButton =
  event.target.closest(
    "[data-delete-asset-folder]"
  );

if (deleteAssetFolderButton) {
  event.preventDefault();
  event.stopPropagation();

  const folderId =
    deleteAssetFolderButton.dataset
      .deleteAssetFolder;

  if (folderId) {
    deleteAssetFolder(
      folderId
    );
  }

  return;
}
  const openAssetFolder =
    event.target.closest(
      "[data-open-asset-folder]"
    );

  if (openAssetFolder) {
    const folderId =
      openAssetFolder.dataset
        .openAssetFolder;

    openAssetFolderById(
      folderId
    );

    return;
  }

  const backAssetFolder =
    event.target.closest(
      "[data-asset-folder-back]"
    );

  if (backAssetFolder) {
    const currentFolder =
      (
        APP_DATA.assetFolders ||
        []
      ).find(
        folder =>
          String(folder.id) ===
          String(
            APP_STATE.activeAssetFolderId
          )
      );

    APP_STATE.activeAssetFolderId =
      currentFolder?.parentFolderId ||
      null;

    renderApp();

    return;
  }

  const closeAssetFolder =
    event.target.closest(
      "[data-close-asset-folder]"
    );

  if (closeAssetFolder) {
    safeDialogClose(
      $("#assetFolderDialog")
    );

    return;
  }

  const createAssetFolder =
    event.target.closest(
      "[data-create-asset-folder]"
    );

  if (createAssetFolder) {
    openCreateAssetFolderDialog();
    return;
  }

  const addAsset =
    event.target.closest(
      "[data-add-asset]"
    );

  if (addAsset) {
    handleAddAsset();
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

    return;
  }

  const brandBrainDialog =
    event.target.closest(
      "#brandBrainDialog"
    );

  if (brandBrainDialog) {
    handleBrandBrainDelegatedClick(
      event
    );
  }
}


/* =========================================================
   BIND STATIC EVENTS
   ========================================================= */

function bindEvents() {
  document.addEventListener(
    "click",
    handleGlobalClick
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      const contentCard =
        event.target.closest(
          "[data-open-content]"
        );

      if (contentCard) {
        event.preventDefault();

        openContentEditor(
          contentCard.dataset
            .openContent
        );

        return;
      }

      const calendarCard =
        event.target.closest(
          "[data-calendar-action]"
        );

      if (!calendarCard) {
        return;
      }

      const action =
        calendarCard.dataset
          .calendarAction;

      const itemId =
        calendarCard.dataset
          .calendarItemId;

      if (
        action === "content" &&
        itemId
      ) {
        event.preventDefault();

        openContentEditor(
          itemId
        );
      }
    }
  );

  $("#brandSwitcher")
    ?.addEventListener(
      "click",
      openBrandPicker
    );

  $("#mobileBrandSwitcher")
    ?.addEventListener(
      "click",
      openBrandPicker
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
      handleAddBrand
    );

  $("#addBrandButton")
    ?.addEventListener(
      "click",
      handleAddBrand
    );

  $("#uploadAssetButton")
    ?.addEventListener(
      "click",
      handleAddAsset
    );

  $("#closeQuickCreateButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          $("#quickCreateDialog")
        );
      }
    );

  $("#cancelQuickCreateButton")
    ?.addEventListener(
      "click",
      () => {
        safeDialogClose(
          $("#quickCreateDialog")
        );
      }
    );

  $("#quickCreateForm")
    ?.addEventListener(
      "submit",
      handleQuickCreateSubmit
    );

  enableBackdropClose(
    $("#brandPickerDialog")
  );

  enableBackdropClose(
    $("#quickCreateDialog")
  );
}


/* =========================================================
   ACTIVE BRAND STORAGE
   ========================================================= */

function readStoredActiveBrandId() {
  return readStorage(
    STORAGE_KEYS.activeBrand,
    null
  );
}

function writeStoredActiveBrandId(
  brandId
) {
  if (brandId) {
    writeStorage(
      STORAGE_KEYS.activeBrand,
      brandId
    );
  }
}


/* =========================================================
   AUTHENTICATED APP START
   ========================================================= */

async function startAuthenticatedApp(
  session
) {
  if (!session?.user) {
    return;
  }

  APP_STATE.user =
    session.user;

  try {
    await loadAppData();

    const storedBrandId =
      readStoredActiveBrandId();

    const storedBrandExists =
      APP_DATA.brands.some(
        brand =>
          brand.id ===
          storedBrandId &&
          brand.active !==
            false
      );

    if (storedBrandExists) {
      APP_STATE.activeBrandId =
        storedBrandId;
    } else {
      APP_STATE.activeBrandId =
        APP_DATA.brands.find(
          brand =>
            brand.active !==
            false
        )?.id ||
        null;
    }

    if (
      APP_STATE.activeBrandId
    ) {
      writeStoredActiveBrandId(
        APP_STATE.activeBrandId
      );
    }

    renderApp();

    navigateToView(
      APP_STATE.activeView ||
      "dashboard"
    );

    showToast(
      "Marketing Studio ready.",
      "success",
      2200
    );

  } catch (error) {
    console.error(
      "Marketing Studio startup failed:",
      error
    );

    showToast(
      error?.message ||
      "Marketing Studio could not load.",
      "error",
      6000
    );
  }
}


/* =========================================================
   AUTH INITIALIZATION
   ========================================================= */

async function initializeAuthentication() {
  if (!supabaseClient) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getSession();

  if (error) {
    console.error(
      "Unable to read Supabase session:",
      error
    );

    showToast(
      "Unable to check your login session.",
      "error",
      5000
    );

    return;
  }

  if (
    data?.session
  ) {
    await startAuthenticatedApp(
      data.session
    );

    return;
  }

  showAuthDialog();

  supabaseClient.auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {
        if (
          event ===
            "SIGNED_IN" &&
          session
        ) {
          safeDialogClose(
            $("#authDialog")
          );

          await startAuthenticatedApp(
            session
          );
        }

        if (
          event ===
          "SIGNED_OUT"
        ) {
          APP_STATE.user =
            null;

          APP_STATE.activeBrandId =
            null;

          APP_DATA.brands =
            [];

          APP_DATA.campaigns =
            [];

          APP_DATA.content =
            [];

          APP_DATA.calendar =
            [];

          APP_DATA.assets =
            [];

          APP_DATA.assetFolders =
            [];

          APP_STATE.activeAssetFolderId =
            null;

          showAuthDialog();
        }
      }
    );
}


/* =========================================================
   INITIALIZE APPLICATION
   ========================================================= */

async function initializeApp() {
  try {
    supabaseClient =
      createSupabaseClient();

    if (!supabaseClient) {
      throw new Error(
        "Supabase is not configured. Check config.js."
      );
    }

    bindEvents();

    await initializeAuthentication();

  } catch (error) {
    console.error(
      "Black Stag Marketing Studio failed to initialize:",
      error
    );

    showToast(
      error?.message ||
      "The app could not initialize.",
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
    initializeApp,
    {
      once: true
    }
  );
} else {
  initializeApp();
}