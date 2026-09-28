
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

  const emberState = {
    brandId: null,
    workItems: [],
    decisions: [],
    loading: false,
    lastLoadedAt: 0
  };

  const emberChatState = {
    brandId: null,
    requestText: "",
    responseText: "",
    errorText: "",
    status: "idle",
    runId: null
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
      "<button class='studio-power-button ember-power-button' type='button' data-ember-open aria-label='Open Ember brief'>✦ <span>Ember</span><strong id='emberAttentionCount'>0</strong></button>" +
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


  function ensureEmberPanel() {
    const dashboard = byId("view-dashboard");

    if (!dashboard || byId("emberDashboardPanel")) {
      return;
    }

    const overview =
      dashboard.querySelector(
        ".dashboard-section"
      );

    if (!overview) {
      return;
    }

    const section =
      document.createElement(
        "section"
      );

    section.id =
      "emberDashboardPanel";

    section.className =
      "dashboard-section ember-dashboard-section";

    section.innerHTML =
      "<div class='section-heading-row'>" +
        "<div><span class='eyebrow'>Ember</span><h2>Daily Brief</h2></div>" +
        "<button class='text-button' type='button' data-ember-open>Open Brief</button>" +
      "</div>" +
      "<div class='ember-brief-card' id='emberBriefCard'>" +
        "<div class='ember-brief-loading'>Connecting Ember to the working brand…</div>" +
      "</div>";

    overview.insertAdjacentElement(
      "afterend",
      section
    );
  }

  function getBrandSignals(brand) {
    const now =
      new Date();

    const horizon =
      new Date(
        now.getTime() +
        7 * 24 * 60 * 60 * 1000
      );

    const content =
      (APP_DATA.content || [])
        .filter(
          item =>
            String(item.brandId) ===
            String(brand.id)
        );

    const campaigns =
      (APP_DATA.campaigns || [])
        .filter(
          item =>
            String(item.brandId) ===
            String(brand.id) &&
            (
              item.status === "active" ||
              item.status === "draft"
            )
        );

    const calendar =
      (APP_DATA.calendar || [])
        .filter(
          item => {
            if (
              String(item.brandId) !==
              String(brand.id) ||
              !item.startsAt
            ) {
              return false;
            }

            const when =
              new Date(
                item.startsAt
              );

            return (
              when >= now &&
              when <= horizon
            );
          }
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt) -
            new Date(b.startsAt)
        );

    const milestones =
      (brand.milestones || [])
        .filter(
          item =>
            item.status === "planned" ||
            item.status === "in_progress"
        );

    const review =
      content.filter(
        item =>
          item.status === "draft" ||
          item.status === "review"
      );

    return {
      campaigns,
      calendar,
      milestones,
      review
    };
  }

  function renderEmberAttentionCount() {
    const count =
      byId(
        "emberAttentionCount"
      );

    if (!count) {
      return;
    }

    const actionableWork =
      emberState.workItems.filter(
        item =>
          item.status !== "done" &&
          item.status !== "cancelled"
      ).length;

    const pendingDecisions =
      emberState.decisions.filter(
        item =>
          item.status === "pending" ||
          item.status === "deferred"
      ).length;

    count.textContent =
      String(
        actionableWork +
        pendingDecisions
      );
  }

  function renderEmberPanel() {
    ensureEmberPanel();

    const host =
      byId(
        "emberBriefCard"
      );

    const brand =
      activeBrand();

    if (!host || !brand) {
      return;
    }

    if (emberState.loading) {
      host.innerHTML =
        "<div class='ember-brief-loading'>Ember is reading the Studio…</div>";

      return;
    }

    const signals =
      getBrandSignals(
        brand
      );

    const work =
      emberState.workItems
        .filter(
          item =>
            item.status !== "done" &&
            item.status !== "cancelled"
        )
        .slice(0, 4);

    const decisions =
      emberState.decisions
        .filter(
          item =>
            item.status === "pending" ||
            item.status === "deferred"
        )
        .slice(0, 3);

    const attention =
      work.length +
      decisions.length +
      signals.review.length;

    const summary =
      attention
        ? "There are " +
          attention +
          " items worth your attention across work, decisions, and drafts."
        : "Nothing is pressing right now. The Studio is clear for proactive work.";

    host.innerHTML =
      "<div class='ember-brief-lead'>" +
        "<div><strong>" +
          escapeHtml(
            brand.shortName ||
            brand.name ||
            "Working brand"
          ) +
        "</strong><p>" +
          escapeHtml(
            summary
          ) +
        "</p></div>" +
        "<button class='secondary-button ember-refresh-button' type='button' data-ember-refresh>Refresh</button>" +
      "</div>" +
      "<div class='ember-signal-grid'>" +
        "<div class='ember-signal'><span>Open Work</span><strong>" +
          work.length +
        "</strong></div>" +
        "<div class='ember-signal'><span>Decisions</span><strong>" +
          decisions.length +
        "</strong></div>" +
        "<div class='ember-signal'><span>Draft / Review</span><strong>" +
          signals.review.length +
        "</strong></div>" +
        "<div class='ember-signal'><span>Campaigns</span><strong>" +
          signals.campaigns.length +
        "</strong></div>" +
        "<div class='ember-signal'><span>Next 7 Days</span><strong>" +
          signals.calendar.length +
        "</strong></div>" +
        "<div class='ember-signal'><span>Milestones</span><strong>" +
          signals.milestones.length +
        "</strong></div>" +
      "</div>" +
      (
        work.length
          ? "<div class='ember-mini-list'><span class='eyebrow'>Next Work</span>" +
            work.map(
              item =>
                "<button class='ember-mini-row' type='button' data-ember-open><strong>" +
                  escapeHtml(
                    item.title
                  ) +
                "</strong><small>" +
                  escapeHtml(
                    item.priority ||
                    "normal"
                  ) +
                " · " +
                  escapeHtml(
                    item.owner_type ||
                    "shared"
                  ) +
                "</small></button>"
            ).join("") +
            "</div>"
          : ""
      ) +
      (
        decisions.length
          ? "<div class='ember-mini-list'><span class='eyebrow'>Needs Your Decision</span>" +
            decisions.map(
              item =>
                "<button class='ember-mini-row ember-decision-row' type='button' data-ember-open><strong>" +
                  escapeHtml(
                    item.title
                  ) +
                "</strong><small>" +
                  escapeHtml(
                    item.question
                  ) +
                "</small></button>"
            ).join("") +
            "</div>"
          : ""
      );

    renderEmberAttentionCount();
  }

  async function refreshEmberOperatingLayer(
    force = false
  ) {
    const brand =
      activeBrand();

    if (
      !brand ||
      !supabaseClient
    ) {
      return;
    }

    const now =
      Date.now();

    if (
      emberState.loading ||
      (
        !force &&
        emberState.brandId ===
          brand.id &&
        now -
          emberState.lastLoadedAt <
          15000
      )
    ) {
      renderEmberPanel();
      return;
    }

    emberState.loading =
      true;

    emberState.brandId =
      brand.id;

    renderEmberPanel();

    try {
      const [
        workResult,
        decisionsResult
      ] =
        await Promise.all([
          supabaseClient
            .from("work_items")
            .select("*")
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
            .order(
              "created_at",
              {
                ascending: false
              }
            ),

          supabaseClient
            .from(
              "decision_requests"
            )
            .select("*")
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
            .order(
              "created_at",
              {
                ascending: false
              }
            )
        ]);

      if (workResult.error) {
        throw workResult.error;
      }

      if (decisionsResult.error) {
        throw decisionsResult.error;
      }

      emberState.workItems =
        workResult.data ||
        [];

      emberState.decisions =
        decisionsResult.data ||
        [];

      emberState.lastLoadedAt =
        Date.now();

    } catch (error) {
      console.error(
        "Ember operating layer failed to load:",
        error
      );

      const host =
        byId(
          "emberBriefCard"
        );

      if (host) {
        host.innerHTML =
          "<div class='empty-state'><h3>Ember could not read the operating layer.</h3><p>" +
          escapeHtml(
            error?.message ||
            "Unknown error"
          ) +
          "</p></div>";
      }

    } finally {
      emberState.loading =
        false;

      renderEmberPanel();
    }
  }

  function emberWorkRows() {
    if (!emberState.workItems.length) {
      return "<div class='empty-state'><h3>No open work.</h3><p>Ember and the owner have a clear queue.</p></div>";
    }

    return emberState.workItems
      .map(
        item =>
          "<article class='ember-dialog-row'>" +
            "<div><span class='eyebrow'>" +
              escapeHtml(
                item.priority ||
                "normal"
              ) +
            " · " +
              escapeHtml(
                item.owner_type ||
                "shared"
              ) +
            "</span><h3>" +
              escapeHtml(
                item.title
              ) +
            "</h3><p>" +
              escapeHtml(
                item.description ||
                item.notes ||
                ""
              ) +
            "</p></div>" +
            "<div class='ember-row-actions'>" +
              "<button class='secondary-button' type='button' data-ember-work-done='" +
                escapeHtml(
                  item.id
                ) +
              "'>Mark Done</button>" +
            "</div>" +
          "</article>"
      )
      .join("");
  }

  function emberDecisionRows() {
    if (!emberState.decisions.length) {
      return "<div class='empty-state'><h3>No decisions waiting.</h3><p>Nothing currently needs owner input.</p></div>";
    }

    return emberState.decisions
      .map(
        item =>
          "<article class='ember-dialog-row ember-dialog-decision'>" +
            "<div><span class='eyebrow'>" +
              escapeHtml(
                item.priority ||
                "normal"
              ) +
            "</span><h3>" +
              escapeHtml(
                item.title
              ) +
            "</h3><p>" +
              escapeHtml(
                item.question
              ) +
            "</p>" +
            (
              item.ember_recommendation
                ? "<div class='ember-recommendation'><strong>Ember's recommendation</strong><p>" +
                  escapeHtml(
                    item.ember_recommendation
                  ) +
                  "</p></div>"
                : ""
            ) +
            "</div>" +
            "<div class='ember-row-actions'>" +
              "<button class='secondary-button' type='button' data-ember-decision-answer='" +
                escapeHtml(
                  item.id
                ) +
              "'>Answer</button>" +
              "<button class='text-button' type='button' data-ember-decision-defer='" +
                escapeHtml(
                  item.id
                ) +
              "'>Defer</button>" +
            "</div>" +
          "</article>"
      )
      .join("");
  }

  function resetEmberChatForBrand(brandId) {
    if (emberChatState.brandId === brandId) {
      return;
    }

    emberChatState.brandId = brandId;
    emberChatState.requestText = "";
    emberChatState.responseText = "";
    emberChatState.errorText = "";
    emberChatState.status = "idle";
    emberChatState.runId = null;
  }

  function renderEmberChatPanel() {
    const host = byId("emberChatPanel");
    const brand = activeBrand();

    if (!host || !brand) {
      return;
    }

    resetEmberChatForBrand(brand.id);

    const busy =
      emberChatState.status === "sending" ||
      emberChatState.status === "waiting";

    let statusHtml = "";

    if (busy) {
      statusHtml =
        "<p class='muted-copy' style='margin:10px 0 0'>Ember is working on this request…</p>";
    } else if (emberChatState.errorText) {
      statusHtml =
        "<div class='empty-state' style='margin-top:10px'><h3>Ember could not answer yet.</h3><p>" +
        escapeHtml(emberChatState.errorText) +
        "</p><button class='secondary-button' type='button' data-ember-chat-retry>Retry Ember</button></div>";
    } else if (emberChatState.responseText) {
      statusHtml =
        "<article class='ember-dialog-row' style='grid-template-columns:1fr;margin-top:10px'><div><span class='eyebrow'>Ember Reply</span><p style='white-space:pre-wrap;margin-top:8px'>" +
        escapeHtml(emberChatState.responseText) +
        "</p></div></article>";
    }

    host.innerHTML =
      "<span class='eyebrow'>Ask Ember</span>" +
      "<h3 style='margin:4px 0 10px'>Live Workspace Agent</h3>" +
      "<label class='field'><span>Message</span>" +
      "<textarea id='emberChatInput' rows='3' maxlength='20000' placeholder='Ask Ember about this brand, the work queue, campaigns, drafts, or what to do next.'" +
      (busy ? " disabled" : "") +
      ">" +
      escapeHtml(emberChatState.requestText) +
      "</textarea></label>" +
      "<div class='form-actions'>" +
      "<span class='muted-copy'>Review-only. Ember cannot publish or take consequential actions from this request.</span>" +
      "<button class='primary-button' type='button' data-ember-chat-send" +
      (busy ? " disabled" : "") +
      ">Send to Ember</button></div>" +
      statusHtml;
  }

  function emberChatContext(brand) {
    const signals = getBrandSignals(brand);

    return {
      source: "ember_daily_brief",
      brand: {
        id: brand.id,
        name: brand.name || null,
        short_name: brand.shortName || null
      },
      open_work: emberState.workItems
        .filter(item => item.status !== "done" && item.status !== "cancelled")
        .slice(0, 10)
        .map(item => ({
          title: item.title,
          description: item.description || item.notes || null,
          priority: item.priority || null,
          owner: item.owner_type || null,
          due_at: item.due_at || null
        })),
      pending_decisions: emberState.decisions
        .filter(item => item.status === "pending" || item.status === "deferred")
        .slice(0, 8)
        .map(item => ({
          title: item.title,
          question: item.question,
          priority: item.priority || null,
          due_at: item.due_at || null
        })),
      active_campaigns: signals.campaigns
        .slice(0, 8)
        .map(item => ({
          name: item.name || null,
          objective: item.objective || null,
          status: item.status || null
        })),
      upcoming_7_days: signals.calendar
        .slice(0, 10)
        .map(item => ({
          title: item.title || null,
          type: item.itemType || item.type || null,
          starts_at: item.startsAt || null
        })),
      draft_review: signals.review
        .slice(0, 8)
        .map(item => ({
          title: item.title || null,
          platform: item.platform || null,
          goal: item.goal || null,
          status: item.status || null
        }))
    };
  }

  async function emberFunctionErrorMessage(error) {
    let message =
      error?.message ||
      "Unable to reach Ember.";

    if (
      error?.context &&
      typeof error.context.json === "function"
    ) {
      try {
        const payload = await error.context.json();
        message =
          payload?.message ||
          payload?.error ||
          message;
      } catch {}
    }

    return message;
  }

  async function waitForEmberChatReply(runId) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve =>
        window.setTimeout(resolve, attempt === 0 ? 1200 : 1800)
      );

      const { data, error } =
        await supabaseClient
          .from("ember_agent_runs")
          .select("status,response_text,error_text")
          .eq("id", runId)
          .single();

      if (error) {
        throw error;
      }

      if (data?.status === "answered" && data.response_text) {
        emberChatState.status = "answered";
        emberChatState.responseText = data.response_text;
        emberChatState.errorText = "";
        renderEmberChatPanel();
        return;
      }

      if (data?.status === "failed" || data?.status === "cancelled") {
        throw new Error(
          data.error_text ||
          "Ember could not complete the request."
        );
      }
    }

    throw new Error(
      "Ember is still working. Retry in a moment."
    );
  }

  async function submitEmberChat(retry = false) {
    const brand = activeBrand();

    if (!brand || !supabaseClient) {
      return;
    }

    resetEmberChatForBrand(brand.id);

    const input = byId("emberChatInput");

    const requestText =
      retry
        ? emberChatState.requestText
        : String(input?.value || "").trim();

    if (!requestText) {
      showToast(
        "Ask Ember something first.",
        "error"
      );

      input?.focus();
      return;
    }

    emberChatState.requestText = requestText;
    emberChatState.responseText = "";
    emberChatState.errorText = "";
    emberChatState.status = "sending";
    renderEmberChatPanel();

    try {
      const { data, error } =
        await supabaseClient
          .functions
          .invoke(
            "trigger-ember-agent",
            {
              body: {
                request_type: "studio_chat",
                brand_id: brand.id,
                request_text: requestText,
                request_context: emberChatContext(brand)
              }
            }
          );

      if (error) {
        throw new Error(
          await emberFunctionErrorMessage(error)
        );
      }

      if (!data?.run_id) {
        throw new Error(
          "Ember request was accepted without a run id."
        );
      }

      emberChatState.runId = data.run_id;
      emberChatState.status = "waiting";
      renderEmberChatPanel();

      await waitForEmberChatReply(data.run_id);

      showToast(
        "Ember replied.",
        "success"
      );
    } catch (error) {
      console.error(
        "Ember Daily Brief request failed:",
        error
      );

      emberChatState.status = "error";
      emberChatState.errorText =
        error?.message ||
        "Ember could not answer this request.";

      renderEmberChatPanel();

      showToast(
        emberChatState.errorText,
        "error",
        6000
      );
    }
  }

  function openEmberBrief() {
    const brand =
      activeBrand();

    if (!brand) {
      return;
    }

    const signals =
      getBrandSignals(
        brand
      );

    const dialog =
      makeDialog(
        "emberBriefDialog",
        "app-dialog ember-brief-dialog"
      );

    dialog.innerHTML =
      "<div class='dialog-header'>" +
        "<div><span class='eyebrow'>Ember</span><h2>Daily Brief · " +
          escapeHtml(
            brand.shortName ||
            brand.name
          ) +
        "</h2></div>" +
        "<button class='dialog-close' type='button' data-power-close>×</button>" +
      "</div>" +
      "<div class='ember-dialog-body'>" +
        "<div class='ember-brief-summary-grid'>" +
          "<div><span>Draft / Review</span><strong>" +
            signals.review.length +
          "</strong></div>" +
          "<div><span>Active / Draft Campaigns</span><strong>" +
            signals.campaigns.length +
          "</strong></div>" +
          "<div><span>Next 7 Days</span><strong>" +
            signals.calendar.length +
          "</strong></div>" +
          "<div><span>Open Milestones</span><strong>" +
            signals.milestones.length +
          "</strong></div>" +
        "</div>" +
        "<section class='ember-dialog-section'><span class='eyebrow'>Work Queue</span>" +
          emberWorkRows() +
        "</section>" +
        "<section class='ember-dialog-section'><span class='eyebrow'>Decision Queue</span>" +
          emberDecisionRows() +
        "</section>" +
      "</div>";

    openDialog(
      dialog
    );
  }

  async function markEmberWorkDone(
    id
  ) {
    const {
      error
    } =
      await supabaseClient
        .from("work_items")
        .update({
          status: "done",
          completed_at:
            new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
      throw error;
    }

    await refreshEmberOperatingLayer(
      true
    );

    openEmberBrief();
  }

  async function answerEmberDecision(
    id
  ) {
    const answer =
      window.prompt(
        "What is your decision?"
      );

    if (
      answer === null ||
      !String(answer).trim()
    ) {
      return;
    }

    const {
      error
    } =
      await supabaseClient
        .from(
          "decision_requests"
        )
        .update({
          status: "answered",
          answer:
            String(answer).trim(),
          answered_at:
            new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
      throw error;
    }

    await refreshEmberOperatingLayer(
      true
    );

    openEmberBrief();
  }

  async function deferEmberDecision(
    id
  ) {
    const {
      error
    } =
      await supabaseClient
        .from(
          "decision_requests"
        )
        .update({
          status: "deferred"
        })
        .eq("id", id);

    if (error) {
      throw error;
    }

    await refreshEmberOperatingLayer(
      true
    );

    openEmberBrief();
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
    ensureEmberPanel();
    refreshEmberOperatingLayer();
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

    if (event.target.closest("[data-ember-open]")) {
      refreshEmberOperatingLayer(true)
        .then(openEmberBrief)
        .catch(error => {
          console.error("Ember brief failed:", error);
        });
      return;
    }

    if (event.target.closest("[data-ember-refresh]")) {
      refreshEmberOperatingLayer(true);
      return;
    }

    const workDone =
      event.target.closest(
        "[data-ember-work-done]"
      );

    if (workDone) {
      markEmberWorkDone(
        workDone.dataset.emberWorkDone
      ).catch(error => {
        console.error(
          "Unable to complete Ember work item:",
          error
        );
      });
      return;
    }

    const decisionAnswer =
      event.target.closest(
        "[data-ember-decision-answer]"
      );

    if (decisionAnswer) {
      answerEmberDecision(
        decisionAnswer.dataset
          .emberDecisionAnswer
      ).catch(error => {
        console.error(
          "Unable to answer Ember decision:",
          error
        );
      });
      return;
    }

    const decisionDefer =
      event.target.closest(
        "[data-ember-decision-defer]"
      );

    if (decisionDefer) {
      deferEmberDecision(
        decisionDefer.dataset
          .emberDecisionDefer
      ).catch(error => {
        console.error(
          "Unable to defer Ember decision:",
          error
        );
      });
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

    let observerFrame =
      null;

    const observer =
      new MutationObserver(
        () => {
          if (observerFrame) {
            return;
          }

          observerFrame =
            window.requestAnimationFrame(
              () => {
                observerFrame =
                  null;

                enhanceCampaignCards();
                enhanceContentCards();
                enhanceAssetCards();
                ensureEmberPanel();
              }
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
