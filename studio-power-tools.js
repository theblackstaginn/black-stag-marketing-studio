
"use strict";

/* =========================================================
   BLACK STAG STUDIO POWER TOOLS
   Visible creation/search/inbox/campaign workflow layer.
   ========================================================= */

(function () {
  const powerState = {
    enhancedCampaignIds: new Set(),
    enhancedContentIds: new Set(),
    enhancedAssetIds: new Set()
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  function activeBrand() {
    try {
      return getActiveBrand();
    } catch {
      return null;
    }
  }

  function campaignById(id) {
    return (APP_DATA.campaigns || []).find(
      item => String(item.id) === String(id)
    ) || null;
  }

  function contentById(id) {
    return (APP_DATA.content || []).find(
      item => String(item.id) === String(id)
    ) || null;
  }

  function assetById(id) {
    return (APP_DATA.assets || []).find(
      item => String(item.id) === String(id)
    ) || null;
  }

  function makeDialog(id, className) {
    let dialog = byId(id);

    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = id;
      dialog.className = className || "app-dialog studio-action-dialog";
      document.body.appendChild(dialog);

      if (typeof enableBackdropClose === "function") {
        enableBackdropClose(dialog);
      }
    }

    return dialog;
  }

  function openDialog(dialog) {
    if (!dialog) {
      return;
    }

    if (typeof safeDialogOpen === "function") {
      safeDialogOpen(dialog);
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function addPowerTools() {
    if (byId("studioPowerTools")) {
      return;
    }

    const host = document.createElement("div");
    host.id = "studioPowerTools";
    host.className = "studio-power-tools";
    host.innerHTML =
      "<button class='studio-power-button' type='button' data-power-search aria-label='Search Studio'>⌕ <span>Search</span></button>" +
      "<button class='studio-power-button' type='button' data-power-inbox aria-label='Studio inbox'>◌ <span>Inbox</span><strong id='studioInboxCount'>0</strong></button>" +
      "<button class='primary-button studio-create-button' type='button' data-power-create>✦ Create</button>";

    document.body.appendChild(host);
    renderInboxCount();
  }

  function renderInboxCount() {
    const brand = activeBrand();
    const count = byId("studioInboxCount");

    if (!count || !brand) {
      return;
    }

    const now = new Date();

    const reviewCount = (APP_DATA.content || []).filter(
      item =>
        String(item.brandId) === String(brand.id) &&
        (item.status === "draft" || item.status === "review")
    ).length;

    const upcomingCount = (APP_DATA.calendar || []).filter(
      item =>
        String(item.brandId) === String(brand.id) &&
        item.startsAt &&
        new Date(item.startsAt) >= now
    ).length;

    count.textContent = String(reviewCount + upcomingCount);
  }

  function openCreateMenu() {
    const dialog = makeDialog("studioCreateMenuDialog");

    dialog.innerHTML =
      "<div class='dialog-header'>" +
        "<div><span class='eyebrow'>Create</span><h2>Build Something</h2></div>" +
        "<button class='dialog-close' type='button' data-power-close>×</button>" +
      "</div>" +
      "<div class='studio-action-grid'>" +
        "<button class='studio-action-card' type='button' data-power-quick='social-post'><strong>Social Content</strong><small>Post, story, reel, email, or website copy.</small></button>" +
        "<button class='studio-action-card' type='button' data-power-quick='campaign'><strong>Campaign</strong><small>Start a campaign or build content around one.</small></button>" +
        "<button class='studio-action-card' type='button' data-power-calendar><strong>Calendar Item</strong><small>Add a launch, event, deadline, or milestone.</small></button>" +
        "<button class='studio-action-card' type='button' data-power-folder><strong>Asset Folder</strong><small>Organize a new creative collection.</small></button>" +
        "<button class='studio-action-card studio-action-card-featured' type='button' data-power-plan><strong>✦ Marketing Plan</strong><small>Build a coordinated campaign, planning brief, dates, and asset folder.</small></button>" +
      "</div>";

    openDialog(dialog);
  }

  function openSearch() {
    const dialog = makeDialog("globalSearchDialog");

    dialog.innerHTML =
      "<div class='dialog-header'>" +
        "<div><span class='eyebrow'>Studio Search</span><h2>Find Anything</h2></div>" +
        "<button class='dialog-close' type='button' data-power-close>×</button>" +
      "</div>" +
      "<div class='studio-search-shell'>" +
        "<input id='globalSearchInput' type='search' placeholder='Search campaigns, content, calendar, assets, Brand Brain…' autocomplete='off' />" +
        "<div id='globalSearchResults'><div class='empty-state'><h3>Search the whole Studio.</h3><p>Campaigns, content, calendar items, assets, and Brand Brain facts.</p></div></div>" +
      "</div>";

    const input = byId("globalSearchInput");

    input?.addEventListener("input", renderSearchResults);

    openDialog(dialog);

    window.setTimeout(() => input?.focus(), 80);
  }

  function renderSearchResults() {
    const input = byId("globalSearchInput");
    const host = byId("globalSearchResults");
    const brand = activeBrand();

    if (!host || !brand) {
      return;
    }

    const query = String(input?.value || "").trim().toLowerCase();

    if (!query) {
      host.innerHTML =
        "<div class='empty-state'><h3>Search the whole Studio.</h3><p>Type a word or phrase.</p></div>";
      return;
    }

    const matches = [];

    (APP_DATA.campaigns || [])
      .filter(item => String(item.brandId) === String(brand.id))
      .forEach(item => {
        const haystack = [item.name, item.description, item.objective]
          .join(" ")
          .toLowerCase();

        if (haystack.includes(query)) {
          matches.push({
            kind: "campaign",
            id: item.id,
            label: "Campaign",
            title: item.name || "Untitled Campaign"
          });
        }
      });

    (APP_DATA.content || [])
      .filter(item => String(item.brandId) === String(brand.id))
      .forEach(item => {
        const haystack = [item.title, item.body, item.platform, item.goal]
          .join(" ")
          .toLowerCase();

        if (haystack.includes(query)) {
          matches.push({
            kind: "content",
            id: item.id,
            label: "Content",
            title: item.title || "Untitled Content"
          });
        }
      });

    (APP_DATA.calendar || [])
      .filter(item => String(item.brandId) === String(brand.id))
      .forEach(item => {
        const haystack = [item.title, item.description, item.itemType]
          .join(" ")
          .toLowerCase();

        if (haystack.includes(query)) {
          matches.push({
            kind: "calendar",
            id: item.id,
            label: "Calendar",
            title: item.title || "Calendar Item"
          });
        }
      });

    (APP_DATA.assets || [])
      .filter(item => String(item.brandId) === String(brand.id))
      .forEach(item => {
        const haystack = [
          item.name,
          item.description,
          ...(item.tags || [])
        ].join(" ").toLowerCase();

        if (haystack.includes(query)) {
          matches.push({
            kind: "asset",
            id: item.id,
            label: "Asset",
            title: item.name || "Untitled Asset"
          });
        }
      });

    (brand.facts || []).forEach(fact => {
      const label =
        fact.subject ||
        fact.fact_key ||
        fact.category ||
        "Brand Fact";

      const value = fact.value_text || "";

      if ((label + " " + value).toLowerCase().includes(query)) {
        matches.push({
          kind: "brand",
          id: brand.id,
          label: "Brand Brain",
          title: label + (value ? ": " + value : "")
        });
      }
    });

    if (!matches.length) {
      host.innerHTML =
        "<div class='empty-state'><h3>No matches.</h3><p>Try a broader word or phrase.</p></div>";
      return;
    }

    host.innerHTML = matches
      .slice(0, 30)
      .map(match =>
        "<button class='studio-search-result' type='button' data-power-result-kind='" +
          escapeHtml(match.kind) +
          "' data-power-result-id='" +
          escapeHtml(match.id) +
          "'>" +
          "<span>" +
            escapeHtml(match.label) +
          "</span>" +
          "<strong>" +
            escapeHtml(match.title) +
          "</strong>" +
        "</button>"
      )
      .join("");
  }

  function openInbox() {
    const dialog = makeDialog("studioInboxDialog");
    const brand = activeBrand();
    const now = new Date();

    if (!brand) {
      return;
    }

    const reviewItems = (APP_DATA.content || []).filter(
      item =>
        String(item.brandId) === String(brand.id) &&
        (item.status === "draft" || item.status === "review")
    );

    const upcoming = (APP_DATA.calendar || [])
      .filter(
        item =>
          String(item.brandId) === String(brand.id) &&
          item.startsAt &&
          new Date(item.startsAt) >= now
      )
      .slice()
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .slice(0, 8);

    const reviewHtml = reviewItems.length
      ? reviewItems
          .slice(0, 8)
          .map(
            item =>
              "<button class='studio-inbox-item' type='button' data-power-result-kind='content' data-power-result-id='" +
                escapeHtml(item.id) +
                "'><strong>" +
                escapeHtml(item.title || "Untitled Content") +
                "</strong><small>" +
                escapeHtml(titleCaseStatus(item.status)) +
                "</small></button>"
          )
          .join("")
      : "<p class='muted-copy'>Nothing waiting on you.</p>";

    const upcomingHtml = upcoming.length
      ? upcoming
          .map(
            item =>
              "<button class='studio-inbox-item' type='button' data-power-result-kind='calendar' data-power-result-id='" +
                escapeHtml(item.id) +
                "'><strong>" +
                escapeHtml(item.title || "Calendar Item") +
                "</strong><small>" +
                escapeHtml(formatDateTime(item.startsAt)) +
                "</small></button>"
          )
          .join("")
      : "<p class='muted-copy'>Nothing imminent.</p>";

    dialog.innerHTML =
      "<div class='dialog-header'>" +
        "<div><span class='eyebrow'>Attention</span><h2>Studio Inbox</h2></div>" +
        "<button class='dialog-close' type='button' data-power-close>×</button>" +
      "</div>" +
      "<div class='studio-inbox-body'>" +
        "<section class='studio-inbox-section'><span class='eyebrow'>Needs Review</span><h3>" +
          reviewItems.length +
          " content item" +
          (reviewItems.length === 1 ? "" : "s") +
        "</h3>" +
        reviewHtml +
        "</section>" +
        "<section class='studio-inbox-section'><span class='eyebrow'>Coming Up</span><h3>" +
          upcoming.length +
          " upcoming item" +
          (upcoming.length === 1 ? "" : "s") +
        "</h3>" +
        upcomingHtml +
        "</section>" +
      "</div>";

    openDialog(dialog);
  }

  function openMarketingPlan() {
    const dialog = makeDialog("marketingPlanDialog", "app-dialog create-dialog");

    dialog.innerHTML =
      "<div class='dialog-header'>" +
        "<div><span class='eyebrow'>Studio Builder</span><h2>Marketing Plan</h2></div>" +
        "<button class='dialog-close' type='button' data-power-close>×</button>" +
      "</div>" +
      "<form id='marketingPlanForm' class='create-form'>" +
        "<label class='field'><span>Plan / campaign name</span><input id='marketingPlanName' type='text' required placeholder='Canopy Reveal' /></label>" +
        "<label class='field'><span>Objective</span><textarea id='marketingPlanObjective' rows='3' required placeholder='What should this plan accomplish?'></textarea></label>" +
        "<div class='studio-form-two'>" +
          "<label class='field'><span>Starts</span><input id='marketingPlanStarts' type='date' /></label>" +
          "<label class='field'><span>Ends</span><input id='marketingPlanEnds' type='date' /></label>" +
        "</div>" +
        "<label class='field'><span>Channels</span><input id='marketingPlanChannels' type='text' placeholder='Instagram, Facebook, TikTok, Email' /></label>" +
        "<label class='field'><span>Deliverables / planning brief</span><textarea id='marketingPlanDeliverables' rows='5' placeholder='One launch post, two reels, story sequence, email…'></textarea></label>" +
        "<label class='field'><span>Asset folder name</span><input id='marketingPlanFolder' type='text' placeholder='Canopy Reveal' /></label>" +
        "<div class='form-actions'>" +
          "<button class='secondary-button' type='button' data-power-close>Cancel</button>" +
          "<button class='primary-button' type='submit'>Build Plan</button>" +
        "</div>" +
      "</form>";

    byId("marketingPlanForm")?.addEventListener(
      "submit",
      createMarketingPlan
    );

    openDialog(dialog);
  }

  async function createMarketingPlan(event) {
    event.preventDefault();

    const brand = activeBrand();

    if (!brand) {
      showToast("Choose a working brand first.", "error");
      return;
    }

    const name = byId("marketingPlanName")?.value?.trim();
    const objective = byId("marketingPlanObjective")?.value?.trim();

    if (!name || !objective) {
      showToast("Add a plan name and objective.", "error");
      return;
    }

    const channels = textToArray(byId("marketingPlanChannels")?.value);
    const deliverables = byId("marketingPlanDeliverables")?.value?.trim() || "";
    const startsOn = byId("marketingPlanStarts")?.value || null;
    const endsOn = byId("marketingPlanEnds")?.value || null;
    const folderName = byId("marketingPlanFolder")?.value?.trim();

    try {
      const campaignResult =
        await supabaseClient
          .from("campaigns")
          .insert({
            brand_id: brand.id,
            name,
            objective,
            description: deliverables || null,
            channels,
            starts_on: startsOn,
            ends_on: endsOn,
            status: "draft"
          })
          .select()
          .single();

      if (campaignResult.error) {
        throw campaignResult.error;
      }

      const campaign = campaignResult.data;

      if (deliverables) {
        const briefResult =
          await supabaseClient
            .from("content_items")
            .insert({
              brand_id: brand.id,
              campaign_id: campaign.id,
              content_type: "campaign",
              status: "draft",
              title: name + " — Planning Brief",
              body: deliverables,
              goal: objective,
              platform: null,
              ai_mode: "studio-plan-builder"
            });

        if (briefResult.error) {
          throw briefResult.error;
        }
      }

      if (folderName) {
        const folderResult =
          await supabaseClient
            .from("asset_folders")
            .insert({
              brand_id: brand.id,
              name: folderName,
              description: "Assets for " + name
            });

        if (folderResult.error) {
          throw folderResult.error;
        }
      }

      closeDialog(byId("marketingPlanDialog"));

      await refreshWorkingData();
      renderApp();

      showToast(
        "Marketing plan created. Open the campaign to build its content, calendar, and assets.",
        "success",
        5200
      );

      openCampaignDetail(campaign.id);
    } catch (error) {
      console.error("Unable to create marketing plan:", error);
      showToast(
        error?.message || "Unable to create the marketing plan.",
        "error",
        5000
      );
    }
  }

  function openCampaignDetail(campaignId) {
    const campaign = campaignById(campaignId);

    if (!campaign) {
      showToast("That campaign could not be found.", "error");
      return;
    }

    const linkedContent = (APP_DATA.content || []).filter(
      item => String(item.campaignId) === String(campaign.id)
    );

    const dateWindowItems = (APP_DATA.calendar || []).filter(item => {
      if (String(item.brandId) !== String(campaign.brandId) || !item.startsAt) {
        return false;
      }

      const date = new Date(item.startsAt);
      const starts = campaign.startsOn
        ? new Date(campaign.startsOn + "T00:00:00")
        : null;
      const ends = campaign.endsOn
        ? new Date(campaign.endsOn + "T23:59:59")
        : null;

      if (starts && date < starts) {
        return false;
      }

      if (ends && date > ends) {
        return false;
      }

      return Boolean(starts || ends);
    });

    const dialog = makeDialog(
      "campaignDetailDialog",
      "app-dialog campaign-detail-dialog"
    );

    const contentHtml = linkedContent.length
      ? linkedContent
          .map(
            item =>
              "<button class='studio-inbox-item' type='button' data-power-result-kind='content' data-power-result-id='" +
                escapeHtml(item.id) +
                "'><strong>" +
                escapeHtml(item.title || "Untitled Content") +
                "</strong><small>" +
                escapeHtml(titleCaseStatus(item.status)) +
                " · " +
                escapeHtml(item.platform || getContentTypeLabel(item.type)) +
                "</small></button>"
          )
          .join("")
      : "<p class='muted-copy'>No content linked yet.</p>";

    const calendarHtml = dateWindowItems.length
      ? dateWindowItems
          .slice(0, 10)
          .map(
            item =>
              "<button class='studio-inbox-item' type='button' data-power-result-kind='calendar' data-power-result-id='" +
                escapeHtml(item.id) +
                "'><strong>" +
                escapeHtml(item.title || "Calendar Item") +
                "</strong><small>" +
                escapeHtml(formatDateTime(item.startsAt)) +
                "</small></button>"
          )
          .join("")
      : "<p class='muted-copy'>No calendar items in this campaign date window yet.</p>";

    dialog.innerHTML =
      "<div class='campaign-detail-shell'>" +
        "<div class='dialog-header'>" +
          "<div><span class='eyebrow'>Campaign</span><h2>" +
            escapeHtml(campaign.name || "Untitled Campaign") +
          "</h2><p class='muted-copy'>" +
            escapeHtml(titleCaseStatus(campaign.status || "draft")) +
          "</p></div>" +
          "<button class='dialog-close' type='button' data-power-close>×</button>" +
        "</div>" +
        "<div class='campaign-detail-body'>" +
          "<div class='campaign-detail-grid'>" +
            "<form id='campaignDetailForm' class='campaign-detail-editor'>" +
              "<input id='campaignDetailId' type='hidden' value='" +
                escapeHtml(campaign.id) +
              "' />" +
              "<label class='field'><span>Name</span><input id='campaignDetailName' type='text' required value='" +
                escapeHtml(campaign.name || "") +
              "' /></label>" +
              "<label class='field'><span>Objective</span><textarea id='campaignDetailObjective' rows='3'>" +
                escapeHtml(campaign.objective || "") +
              "</textarea></label>" +
              "<label class='field'><span>Description</span><textarea id='campaignDetailDescription' rows='4'>" +
                escapeHtml(campaign.description || "") +
              "</textarea></label>" +
              "<div class='studio-form-two'>" +
                "<label class='field'><span>Status</span><select id='campaignDetailStatus'>" +
                  ["draft","active","completed","archived"]
                    .map(
                      status =>
                        "<option value='" +
                          status +
                          "'" +
                          (campaign.status === status ? " selected" : "") +
                        ">" +
                          escapeHtml(titleCaseStatus(status)) +
                        "</option>"
                    )
                    .join("") +
                "</select></label>" +
                "<label class='field'><span>Channels</span><input id='campaignDetailChannels' type='text' value='" +
                  escapeHtml((campaign.channels || []).join(", ")) +
                "' /></label>" +
              "</div>" +
              "<label class='field'><span>Call to action</span><input id='campaignDetailCta' type='text' value='" +
                escapeHtml(campaign.cta || "") +
              "' /></label>" +
              "<div class='form-actions'>" +
                "<button class='secondary-button' type='button' data-power-campaign-content='" +
                  escapeHtml(campaign.id) +
                "'>+ Content</button>" +
                "<button class='secondary-button' type='button' data-power-calendar>+ Calendar</button>" +
                "<button class='primary-button' type='submit'>Save Campaign</button>" +
              "</div>" +
            "</form>" +
            "<aside class='campaign-detail-related'>" +
              "<span class='eyebrow'>Campaign Workspace</span>" +
              "<h3>" +
                linkedContent.length +
                " linked content item" +
                (linkedContent.length === 1 ? "" : "s") +
              "</h3>" +
              contentHtml +
              "<div style='height:14px'></div>" +
              "<span class='eyebrow'>Calendar Window</span>" +
              calendarHtml +
            "</aside>" +
          "</div>" +
        "</div>" +
      "</div>";

    byId("campaignDetailForm")?.addEventListener(
      "submit",
      saveCampaignDetail
    );

    openDialog(dialog);
  }

  async function saveCampaignDetail(event) {
    event.preventDefault();

    const id = byId("campaignDetailId")?.value;

    if (!id) {
      return;
    }

    try {
      const result =
        await supabaseClient
          .from("campaigns")
          .update({
            name: byId("campaignDetailName")?.value?.trim(),
            objective: nullableText(byId("campaignDetailObjective")?.value),
            description: nullableText(byId("campaignDetailDescription")?.value),
            status: byId("campaignDetailStatus")?.value || "draft",
            channels: textToArray(byId("campaignDetailChannels")?.value),
            cta: nullableText(byId("campaignDetailCta")?.value),
            updated_at: new Date().toISOString()
          })
          .eq("id", id);

      if (result.error) {
        throw result.error;
      }

      await refreshWorkingData();
      renderApp();
      openCampaignDetail(id);
      showToast("Campaign updated.", "success");
    } catch (error) {
      console.error("Unable to save campaign:", error);
      showToast(error?.message || "Unable to save campaign.", "error");
    }
  }

  function openAssetWorkflow(assetId, action) {
    const asset = assetById(assetId);

    if (!asset) {
      return;
    }

    if (action === "post") {
      openQuickCreate("social-post");

      const prompt = byId("createPrompt");

      if (prompt) {
        prompt.value =
          "Create a social post using the Asset Vault item \"" +
          asset.name +
          "\". Visual direction: " +
          (asset.description || asset.altText || "use this approved asset") +
          ".";
      }

      return;
    }

    if (action === "campaign") {
      openQuickCreate("campaign");

      const prompt = byId("createPrompt");

      if (prompt) {
        prompt.value =
          "Build a campaign around the Asset Vault item \"" +
          asset.name +
          "\". " +
          (asset.description || "");
      }
    }
  }

  function enhanceCampaignCards() {
    const host = byId("campaignList");

    if (!host) {
      return;
    }

    host.querySelectorAll(".content-panel").forEach(card => {
      const buildButton = card.querySelector("[data-campaign-id]");
      const id = buildButton?.dataset?.campaignId;

      if (!id || card.dataset.powerEnhancedCampaign === "1") {
        return;
      }

      card.dataset.powerEnhancedCampaign = "1";

      const controls = buildButton.parentElement || card;
      const openButton = document.createElement("button");
      openButton.className = "secondary-button";
      openButton.type = "button";
      openButton.textContent = "Open Campaign";
      openButton.dataset.powerCampaign = id;

      controls.insertBefore(openButton, buildButton);
    });
  }

  function enhanceContentCards() {
    const host = byId("contentLibrary");

    if (!host) {
      return;
    }

    host.querySelectorAll("[data-open-content]").forEach(card => {
      const id = card.dataset.openContent;
      const item = contentById(id);

      if (!item || card.dataset.powerEnhancedContent === "1") {
        return;
      }

      card.dataset.powerEnhancedContent = "1";

      const heading = card.querySelector("h3");

      if (heading) {
        const chip = document.createElement("span");
        chip.className = "power-status-chip";
        chip.textContent =
          item.aiMode
            ? "AI assisted"
            : "Studio";

        heading.insertAdjacentElement("afterend", chip);

        if (item.campaignId) {
          const campaign = campaignById(item.campaignId);

          if (campaign) {
            const campaignChip = document.createElement("span");
            campaignChip.className = "power-status-chip";
            campaignChip.textContent = campaign.name;
            heading.insertAdjacentElement("afterend", campaignChip);
          }
        }
      }

      const actions = document.createElement("div");
      actions.className = "power-card-actions";
      actions.innerHTML =
        "<button class='power-card-button' type='button' data-power-ai-action='rewrite' data-power-content-id='" +
          escapeHtml(id) +
          "'>✦ Rewrite</button>" +
        "<button class='power-card-button' type='button' data-power-ai-action='variants' data-power-content-id='" +
          escapeHtml(id) +
          "'>Variants</button>" +
        "<button class='power-card-button' type='button' data-power-ai-action='reel' data-power-content-id='" +
          escapeHtml(id) +
          "'>Turn Into Reel</button>";

      card.appendChild(actions);
    });
  }

  function enhanceAssetCards() {
    const host = byId("assetGrid");

    if (!host) {
      return;
    }

    host.querySelectorAll("[data-open-asset]").forEach(card => {
      const id = card.dataset.openAsset;

      if (!id || card.dataset.powerEnhancedAsset === "1") {
        return;
      }

      card.dataset.powerEnhancedAsset = "1";

      const actions = document.createElement("div");
      actions.className = "power-card-actions";
      actions.innerHTML =
        "<button class='power-card-button' type='button' data-power-asset-action='post' data-power-asset-id='" +
          escapeHtml(id) +
          "'>Use in Post</button>" +
        "<button class='power-card-button' type='button' data-power-asset-action='campaign' data-power-asset-id='" +
          escapeHtml(id) +
          "'>Build Campaign</button>";

      card.appendChild(actions);
    });
  }

  function enhanceVisibleCards() {
    renderInboxCount();
    enhanceCampaignCards();
    enhanceContentCards();
    enhanceAssetCards();
  }

  function runAiContextAction(contentId, action) {
    const item = contentById(contentId);

    if (!item) {
      return;
    }

    let type = item.type || "social-post";
    let request = "";

    if (action === "rewrite") {
      request =
        "Rewrite this content while preserving its intent and factual meaning:\n\n" +
        (item.body || "");
    }

    if (action === "variants") {
      request =
        "Create several strong alternate versions of this content:\n\n" +
        (item.body || "");
    }

    if (action === "reel") {
      type = "reel";
      request =
        "Turn this content into a short-form reel/video concept and script:\n\n" +
        (item.body || "");
    }

    openQuickCreate(type);

    const prompt = byId("createPrompt");

    if (prompt) {
      prompt.value = request;
    }
  }

  function handlePowerClick(event) {
    const close = event.target.closest("[data-power-close]");

    if (close) {
      closeDialog(close.closest("dialog"));
      return;
    }

    if (event.target.closest("[data-power-create]")) {
      openCreateMenu();
      return;
    }

    if (event.target.closest("[data-power-search]")) {
      openSearch();
      return;
    }

    if (event.target.closest("[data-power-inbox]")) {
      openInbox();
      return;
    }

    const quick = event.target.closest("[data-power-quick]");

    if (quick) {
      closeDialog(quick.closest("dialog"));
      openQuickCreate(quick.dataset.powerQuick);
      return;
    }

    if (event.target.closest("[data-power-calendar]")) {
      closeDialog(event.target.closest("dialog"));
      openCalendarItemDialog();
      return;
    }

    if (event.target.closest("[data-power-folder]")) {
      closeDialog(event.target.closest("dialog"));
      openCreateAssetFolderDialog();
      return;
    }

    if (event.target.closest("[data-power-plan]")) {
      closeDialog(event.target.closest("dialog"));
      openMarketingPlan();
      return;
    }

    const campaignButton = event.target.closest("[data-power-campaign]");

    if (campaignButton) {
      event.preventDefault();
      event.stopPropagation();
      openCampaignDetail(campaignButton.dataset.powerCampaign);
      return;
    }

    const campaignContent = event.target.closest("[data-power-campaign-content]");

    if (campaignContent) {
      closeDialog(campaignContent.closest("dialog"));
      openQuickCreate("social-post");

      const prompt = byId("createPrompt");
      const campaign = campaignById(
        campaignContent.dataset.powerCampaignContent
      );

      if (prompt && campaign) {
        prompt.value =
          "Create content for the campaign \"" +
          campaign.name +
          "\". Campaign objective: " +
          (campaign.objective || "support the campaign goal") +
          ".";
      }

      return;
    }

    const result = event.target.closest("[data-power-result-kind]");

    if (result) {
      const kind = result.dataset.powerResultKind;
      const id = result.dataset.powerResultId;

      closeDialog(result.closest("dialog"));

      if (kind === "campaign") {
        openCampaignDetail(id);
      } else if (kind === "content") {
        openContentEditor(id);
      } else if (kind === "calendar") {
        openCalendarItemEditor(id);
      } else if (kind === "asset") {
        openAssetEditor(id);
      } else if (kind === "brand") {
        openBrandBrain(id);
      }

      return;
    }

    const assetAction = event.target.closest("[data-power-asset-action]");

    if (assetAction) {
      event.preventDefault();
      event.stopPropagation();

      openAssetWorkflow(
        assetAction.dataset.powerAssetId,
        assetAction.dataset.powerAssetAction
      );

      return;
    }

    const aiAction = event.target.closest("[data-power-ai-action]");

    if (aiAction) {
      event.preventDefault();
      event.stopPropagation();

      runAiContextAction(
        aiAction.dataset.powerContentId,
        aiAction.dataset.powerAiAction
      );
    }
  }

  function startPowerTools() {
    addPowerTools();
    enhanceVisibleCards();

    document.addEventListener(
      "click",
      handlePowerClick,
      true
    );

    const observer =
      new MutationObserver(
        () => {
          window.requestAnimationFrame(
            enhanceVisibleCards
          );
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

    window.setInterval(
      enhanceVisibleCards,
      2500
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startPowerTools
    );
  } else {
    startPowerTools();
  }
})();
