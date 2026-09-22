/* =========================================================
   BLACK STAG MARKETING STUDIO
   app.js
   v1

   Application shell:
   - Navigation
   - Brand switching
   - Starter brand architecture
   - Quick Create
   - Filters
   - Dialogs
   - Toasts
   - Local app state

   No AI or Supabase calls yet.
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


function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function safeDialogOpen(dialog) {
  if (!dialog) return;

  if (!dialog.open) {
    dialog.showModal();
  }
}


function safeDialogClose(dialog) {
  if (!dialog) return;

  if (dialog.open) {
    dialog.close();
  }
}


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEYS = {
  activeBrand:
    "blackStagMarketingStudio.activeBrand",

  lastView:
    "blackStagMarketingStudio.lastView"
};


function readStorage(key, fallback = null) {
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


function writeStorage(key, value) {
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
   STARTER BRAND DATA

   This is temporary seed data.

   Later:
   Supabase becomes the source of truth and these records
   will be loaded from the Brand Brain database.
   ========================================================= */

const STARTER_BRANDS = [
  {
    id: "stag-and-stone",

    name:
      "Stag & Stone Coffee and Bakehouse",

    shortName:
      "Stag & Stone",

    mark:
      "S&S",

    website:
      "https://stagandstonecoffee.com",

    businessType:
      "Coffeehouse & Bakehouse",

    stage:
      "pre-opening",

    stageLabel:
      "Pre-opening",

    primaryGoal:
      "Build awareness, familiarity, curiosity, and anticipation before opening.",

    campaignPhase:
      "early-ramp",

    openingDate:
      null,

    openingDateConfirmed:
      false,

    identity: {
      tagline:
        "Crafted for the morning ritual.",

      personality: [
        "Appalachian",
        "handcrafted",
        "warm",
        "old-world",
        "slightly mysterious",
        "atmospheric"
      ]
    },

    aiRules: [
      "Never imply the physical cafe is currently open.",
      "Never invent an opening date.",
      "Never invent operating hours.",
      "Never invent prices.",
      "Never invent menu items.",
      "Never advertise an unconfirmed item as available.",
      "Use coming-soon language where appropriate.",
      "Favor storytelling, previews, progress, and behind-the-scenes content.",
      "Mystical and folkloric language is appropriate.",
      "Avoid Halloween clichés and costume-shop witchiness."
    ]
  },


  {
    id: "black-stag-web-design",

    name:
      "Black Stag Web Design",

    shortName:
      "Black Stag Web Design",

    mark:
      "BS",

    website:
      "https://blackstagweb.com",

    businessType:
      "Web Design",

    stage:
      "operating",

    stageLabel:
      "Operating",

    primaryGoal:
      "Generate qualified local leads and demonstrate the value of owning a custom-built website.",

    campaignPhase:
      "ongoing",

    identity: {
      personality: [
        "direct",
        "craft-focused",
        "independent",
        "local",
        "practical",
        "custom-built"
      ]
    },

    aiRules: [
      "Do not imply clients rent their websites.",
      "Emphasize ownership when relevant.",
      "Do not invent project results or client testimonials.",
      "Do not misrepresent concept work as paid client work.",
      "Do not invent pricing.",
      "Avoid generic agency jargon.",
      "Do not promise services the business does not currently offer."
    ]
  },


  {
    id: "lace-and-leather",

    name:
      "Lace & Leather",

    shortName:
      "Lace & Leather",

    mark:
      "L&L",

    website:
      "https://laceleatherarcane.com",

    businessType:
      "Digital Art & Fantasy Assets",

    stage:
      "operating",

    stageLabel:
      "Operating",

    primaryGoal:
      "Grow awareness and sales of digital creative assets while supporting fantasy map commissions.",

    campaignPhase:
      "ongoing",

    identity: {
      personality: [
        "arcane",
        "textural",
        "artistic",
        "aged",
        "elegant",
        "fantasy-focused"
      ]
    },

    aiRules: [
      "Do not invent products or product prices.",
      "Do not invent commission availability.",
      "Do not describe previews as reusable full-resolution assets.",
      "Preserve the distinction between digital products and custom commissions.",
      "Avoid generic fake-grunge language.",
      "Favor believable material texture and archival fantasy aesthetics."
    ]
  }
];


/* =========================================================
   APP DATA

   Empty by design.

   We are not filling the interface with fake campaigns,
   posts, assets, or analytics.
   ========================================================= */

const APP_DATA = {
  brands: [...STARTER_BRANDS],

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

  activeBrandId:
    readStorage(
      STORAGE_KEYS.activeBrand,
      STARTER_BRANDS[0]?.id ?? null
    ),

  campaignFilter:
    "all",

  contentFilter:
    "all",

  assetFilter:
    "all",

  createType:
    "social-post"
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
   CREATE TYPE DEFINITIONS
   ========================================================= */

const CREATE_TYPES = {
  "social-post": {
    label:
      "Social Post",

    defaultGoal:
      "awareness"
  },

  story: {
    label:
      "Story",

    defaultGoal:
      "awareness"
  },

  reel: {
    label:
      "Reel / Video Script",

    defaultGoal:
      "engagement"
  },

  graphic: {
    label:
      "Promotional Graphic",

    defaultGoal:
      "awareness"
  },

  email: {
    label:
      "Email",

    defaultGoal:
      "awareness"
  },

  campaign: {
    label:
      "Campaign",

    defaultGoal:
      "awareness"
  },

  "website-copy": {
    label:
      "Website Copy",

    defaultGoal:
      "traffic"
  }
};


/* =========================================================
   ACTIVE BRAND
   ========================================================= */

function getBrandById(brandId) {
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
    APP_DATA.brands[0] ?? null;

  APP_STATE.activeBrandId =
    fallback?.id ?? null;

  if (fallback) {
    writeStorage(
      STORAGE_KEYS.activeBrand,
      fallback.id
    );
  }

  return fallback;
}


function setActiveBrand(brandId) {
  const brand =
    getBrandById(brandId);

  if (!brand) {
    showToast(
      "That brand could not be found.",
      "error"
    );

    return;
  }

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
  syncQuickCreateBrand();

  showToast(
    `Working brand changed to ${brand.shortName}.`,
    "success"
  );
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
        <p>
          No brands have been added yet.
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
            class="brand-switcher
              ${
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
          No brands yet.
        </h3>

        <p>
          Add a brand to begin building
          its Brand Brain.
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
        No brands connected yet
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

  if (!select) {
    return;
  }

  const activeBrand =
    getActiveBrand();

  if (!activeBrand) {
    return;
  }

  select.value =
    activeBrand.id;
}


/* =========================================================
   DASHBOARD
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

  if (hour >= 5 && hour < 12) {
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


function getBrandScopedItems(
  items,
  brandId
) {
  if (!brandId) {
    return [];
  }

  return items.filter(
    item =>
      item.brandId === brandId
  );
}


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

  const brandCalendar =
    getBrandScopedItems(
      APP_DATA.calendar,
      brand.id
    );


  const reviewCount =
    brandContent.filter(
      item =>
        item.status === "review"
    ).length;


  const activeCampaignCount =
    brandCampaigns.filter(
      item =>
        item.status === "active"
    ).length;


  const now =
    Date.now();


  const upcomingItems =
    brandCalendar
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
          time >= now
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
      String(upcomingItems.length);
  }

  if (campaignElement) {
    campaignElement.textContent =
      String(activeCampaignCount);
  }


  renderDashboardUpcoming(
    upcomingItems
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
          Approved content will appear
          here once it has a publishing
          date.
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

function formatDateTime(value) {
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
      hour: "numeric",
      minute: "2-digit"
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
        top: 0,
        behavior:
          options.instant
            ? "auto"
            : "smooth"
      });
    }

    window.scrollTo({
      top: 0,
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


function setCampaignFilter(value) {
  APP_STATE.campaignFilter =
    value || "all";

  setFilterButtons(
    "[data-campaign-filter]",
    "campaignFilter",
    APP_STATE.campaignFilter
  );

  renderCampaigns();
}


function setContentFilter(value) {
  APP_STATE.contentFilter =
    value || "all";

  setFilterButtons(
    "[data-content-filter]",
    "contentFilter",
    APP_STATE.contentFilter
  );

  renderContentLibrary();
}


function setAssetFilter(value) {
  APP_STATE.assetFilter =
    value || "all";

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

  if (!list) {
    return;
  }

  const brand =
    getActiveBrand();

  if (!brand) {
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
        >
          <span class="eyebrow">
            ${
              escapeHtml(
                campaign.status ||
                "Draft"
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

  if (!library) {
    return;
  }

  const brand =
    getActiveBrand();

  if (!brand) {
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
      .map(item => `
        <article
          class="content-panel"
        >
          <span class="eyebrow">
            ${
              escapeHtml(
                item.status ||
                "Draft"
              )
            }
          </span>

          <h3>
            ${
              escapeHtml(
                item.title ||
                "Untitled Content"
              )
            }
          </h3>
        </article>
      `)
      .join("");
}


/* =========================================================
   ASSETS
   ========================================================= */

function renderAssets() {
  const grid =
    $("#assetGrid");

  if (!grid) {
    return;
  }

  const brand =
    getActiveBrand();

  if (!brand) {
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
   QUICK CREATE
   ========================================================= */

function openQuickCreate(
  createType = "social-post"
) {
  const type =
    CREATE_TYPES[createType]
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


  window.setTimeout(() => {
    prompt?.focus();
  }, 120);
}


function closeQuickCreate() {
  safeDialogClose(
    $("#quickCreateDialog")
  );
}


function handleQuickCreateSubmit(
  event
) {
  event.preventDefault();

  const brandId =
    $("#createBrand")?.value;

  const prompt =
    $("#createPrompt")
      ?.value
      ?.trim();

  const goal =
    $("#createGoal")?.value;

  const type =
    $("#createContentType")?.value;


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


  if (!prompt) {
    showToast(
      "Tell the studio what you want to market.",
      "error"
    );

    $("#createPrompt")?.focus();

    return;
  }


  /*
     This is intentionally where the future AI
     generation pipeline will begin.

     For now we confirm that the request is valid
     without pretending AI is connected.
  */

  console.info(
    "Quick Create request:",
    {
      brandId:
        brand.id,

      type,

      goal,

      prompt
    }
  );


  closeQuickCreate();


  showToast(
    "The creation workflow is ready. AI comes next.",
    "success"
  );


  const promptField =
    $("#createPrompt");

  if (promptField) {
    promptField.value =
      "";
  }
}


/* =========================================================
   BRAND BRAIN PLACEHOLDER
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

  /*
     The actual Brand Brain editor will become
     its own interface in the next phase.
  */

  setActiveBrand(
    brand.id
  );

  showToast(
    `${brand.shortName} Brand Brain is the next layer we’ll connect.`,
    "success"
  );
}


/* =========================================================
   ADD BRAND PLACEHOLDER
   ========================================================= */

function handleAddBrand() {
  showToast(
    "Custom brand creation will connect with the Brand Brain database.",
    "success"
  );
}


/* =========================================================
   ASSET PLACEHOLDER
   ========================================================= */

function handleAddAsset() {
  showToast(
    "Asset uploads will connect when the vault backend is added.",
    "success"
  );
}


/* =========================================================
   SETTINGS PLACEHOLDERS
   ========================================================= */

function handleSettingsSection(
  section
) {
  const labels = {
    ai:
      "AI settings",

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


  window.setTimeout(() => {
    toast.style.opacity =
      "0";

    toast.style.transform =
      "translateY(5px)";
  }, Math.max(
    500,
    duration - 250
  ));


  window.setTimeout(() => {
    toast.remove();
  }, duration);
}


/* =========================================================
   DIALOG BACKDROP CLICK
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
        event.target === dialog
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
    const view =
      viewButton.dataset.view;

    setView(view);

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
    const filter =
      campaignFilterButton.dataset
        .campaignFilter;

    setView(
      "campaigns"
    );

    setCampaignFilter(
      filter
    );

    return;
  }


  const contentFilterButton =
    event.target.closest(
      "[data-content-filter]"
    );

  if (contentFilterButton) {
    const filter =
      contentFilterButton.dataset
        .contentFilter;

    setView(
      "studio"
    );

    setContentFilter(
      filter
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
        event.key !== "Escape"
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
      scroll: false,
      instant: true
    }
  );
}


/* =========================================================
   BOOT
   ========================================================= */

function init() {
  bindEvents();
  renderApp();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    {
      once: true
    }
  );
} else {
  init();
}