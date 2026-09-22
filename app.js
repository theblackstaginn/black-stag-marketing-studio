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
  assets: []
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


function normalizeAsset(row) {
  return {
    id:
      row.id,

    brandId:
      row.brand_id,

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

            <select
              id="contentEditorStatus"
            >

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
            Scheduled date & time
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


  let assets =
    APP_DATA.assets
      .filter(
        asset =>
          asset.brandId ===
            brand.id &&
          asset.active !==
            false
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


  if (!assets.length) {
    container.innerHTML = `
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
            activeFilter ===
              "all"
              ? "The Asset Vault is empty."
              : `No ${escapeHtml(
                  titleCaseStatus(
                    activeFilter
                  )
                )} here yet.`
          }
        </h3>

        <p>
          Logos, photography, generated artwork,
          and reusable brand assets will live here.
        </p>

        <button
          class="secondary-button"
          type="button"
          data-add-asset
        >
          Add Asset
        </button>

      </div>
    `;

    return;
  }


  container.innerHTML =
    assets
      .map(
        asset =>
          renderAssetCard(
            asset
          )
      )
      .join("");
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

function renderAssetCard(
  asset
) {
  const imageUrl =
    asset.externalUrl ||
    "";


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
      style="
        min-width:0;
        overflow:hidden;
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
   ADD ASSET PLACEHOLDER
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


  showToast(
    `Asset uploads for ${brand.shortName} are next on the build list.`,
    "success"
  );
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


  /*
    Make the selected Quick Create brand the current
    working brand so the rest of the app remains in
    the same context.
  */

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


  /*
    Only information that has actually been verified
    or explicitly approved by the owner enters the
    factual section of an ordinary marketing prompt.

    AI suggestions and facts awaiting confirmation
    remain stored in Brand Brain but are not treated
    as factual marketing claims.
  */

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
                  margin:
                    4px 0 0;
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
              margin:
                8px 0 0;
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
                margin:
                  4px 0 0;
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
   SETTINGS PLACEHOLDER
   ========================================================= */

function handleSettingsSection(
  section
) {
  const labels = {
    ai:
      "AI Settings",

    social:
      "Social Accounts",

    publishing:
      "Publishing Settings",

    preferences:
      "App Preferences"
  };


  showToast(
    `${
      labels[section] ||
      "Settings"
    } will be wired in the next phase.`,
    "success",
    4000
  );
}


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


  /*
    Source of Truth actions
  */

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


  /*
    AI Guardrail actions
  */

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


  /*
    Milestone actions
  */

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
  /*
    Main navigation
  */

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


  /*
    Quick Create buttons
  */

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


  /*
    Brand selection
  */

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


  /*
    Brand card "Work With Brand"
  */

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


  /*
    Open Brand Brain
  */

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


  /*
    Campaign filters
  */

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

  /*
    Open Content Editor
  */

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

  /*
    Content filters
  */

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


  /*
    Asset filters
  */

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


  /*
    Asset empty-state button
  */

  const addAsset =
    event.target.closest(
      "[data-add-asset]"
    );


  if (addAsset) {
    handleAddAsset();

    return;
  }


  /*
    Settings cards
  */

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


  /*
    Brand Brain actions
  */

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
        event.key !==
          "Enter" &&
        event.key !==
          " "
      ) {
        return;
      }


      const contentCard =
        event.target.closest(
          "[data-open-content]"
        );


      if (!contentCard) {
        return;
      }


      event.preventDefault();


      openContentEditor(
        contentCard.dataset
          .openContent
      );
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
