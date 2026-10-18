"use strict";

(() => {
  const STORAGE_ACTIVE_BRAND = "blackStagMarketingStudio.activeBrand";
  const STORAGE_LAST_VIEW = "blackStagMarketingStudio.lastView";
  const RUN_PREFIX = "blackStagMarketingStudio.campaignForge.run.";

  const els = {
    status: document.getElementById("status"),
    form: document.getElementById("forgeForm"),
    brand: document.getElementById("brand"),
    landingUrl: document.getElementById("landingUrl"),
    offer: document.getElementById("offer"),
    goal: document.getElementById("goal"),
    angle: document.getElementById("angle"),
    draftCount: document.getElementById("draftCount"),
    notes: document.getElementById("notes"),
    forgeButton: document.getElementById("forgeButton"),
    clearButton: document.getElementById("clearButton"),
    brainBadge: document.getElementById("brainBadge"),
    brainSummary: document.getElementById("brainSummary"),
    handoffPanel: document.getElementById("handoffPanel"),
    handoffTitle: document.getElementById("handoffTitle"),
    handoffBadge: document.getElementById("handoffBadge"),
    handoffText: document.getElementById("handoffText"),
    shareButton: document.getElementById("shareButton"),
    copyButton: document.getElementById("copyButton"),
    checkButton: document.getElementById("checkButton"),
    newButton: document.getElementById("newButton"),
    replyCard: document.getElementById("replyCard"),
    replyText: document.getElementById("replyText")
  };

  const config = window.BLACK_STAG_CONFIG?.supabase || {};
  const state = {
    client: null,
    brands: [],
    brand: null,
    runId: null,
    handoff: "",
    busy: false,
    contextCounts: null
  };

  const goalLabels = {
    leads: "Generate leads",
    sales: "Drive sales",
    traffic: "Drive website traffic",
    awareness: "Build awareness",
    launch: "Launch / announcement",
    retargeting: "Retarget warm audiences"
  };

  const angleLabels = {
    balanced: "Balanced, strongest strategic fit",
    "direct-response": "Direct response",
    local: "Local / community",
    "benefit-first": "Benefit first",
    curiosity: "Curiosity / hook driven",
    launch: "Launch / anticipation",
    seasonal: "Seasonal"
  };

  function say(message, type = "") {
    els.status.textContent = message;
    els.status.className = "status-panel" + (type ? " " + type : "");
  }

  function getStored(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function setStored(key, value) {
    try {
      if (value === null || value === undefined || value === "") {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, String(value));
      }
    } catch {}
  }

  function brandName(brand) {
    return brand?.short_name || brand?.official_name || "Brand";
  }

  function normalizeUrl(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    const candidate = /^[a-z]+:\/\//i.test(text) ? text : "https://" + text;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function selectedChannels() {
    return Array.from(document.querySelectorAll('input[name="channels"]:checked'))
      .map(input => input.value)
      .filter(Boolean);
  }

  function setBusy(value) {
    state.busy = Boolean(value);
    els.forgeButton.disabled = state.busy || !state.brand;
    els.shareButton.disabled = state.busy || !state.handoff;
    els.copyButton.disabled = state.busy || !state.handoff;
    els.checkButton.disabled = state.busy || !state.runId;
    els.brand.disabled = state.busy || state.brands.length === 0;
  }

  function openStudioView(view) {
    setStored(STORAGE_LAST_VIEW, view);
    window.location.href = "./";
  }

  document.querySelectorAll("[data-open-view]").forEach(button => {
    button.addEventListener("click", () => openStudioView(button.dataset.openView || "dashboard"));
  });

  async function countRows(table, brandId, extra = null) {
    let query = state.client.from(table).select("id", { count: "exact", head: true }).eq("brand_id", brandId);
    if (typeof extra === "function") query = extra(query);
    const { count, error } = await query;
    if (error) return null;
    return Number(count || 0);
  }

  async function loadBrainSummary() {
    if (!state.brand) return;
    const brandId = state.brand.id;
    els.brainBadge.textContent = "Checking";
    els.brainBadge.className = "pill muted";
    els.brainSummary.innerHTML = "<p>Reading the live Studio context for " + escapeHtml(brandName(state.brand)) + "…</p>";

    const [audiences, facts, rules, products, feedback, campaigns] = await Promise.all([
      countRows("brand_audiences", brandId, q => q.eq("active", true)),
      countRows("brand_facts", brandId, q => q.eq("active", true)),
      countRows("brand_rules", brandId, q => q.eq("active", true)),
      countRows("products_services", brandId, q => q.eq("active", true)),
      countRows("marketing_feedback", brandId, q => q.eq("apply_to_future", true)),
      countRows("campaigns", brandId)
    ]);

    if (!state.brand || state.brand.id !== brandId) return;

    state.contextCounts = { audiences, facts, rules, products, feedback, campaigns };
    els.brainBadge.textContent = "Live";
    els.brainBadge.className = "pill";

    const chips = [
      ["Audiences", audiences],
      ["Facts", facts],
      ["Rules", rules],
      ["Products", products],
      ["Learned notes", feedback],
      ["Campaigns", campaigns]
    ].filter(([, value]) => value !== null);

    els.brainSummary.innerHTML =
      "<p><strong>" + escapeHtml(brandName(state.brand)) + "</strong> is connected. Ember will still read the full Brand Brain at forge time, not just this summary.</p>" +
      "<div class='brain-facts'>" +
      chips.map(([label, value]) => "<span>" + escapeHtml(label) + " · " + value + "</span>").join("") +
      "</div>";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadBrands() {
    const { data, error } = await state.client
      .from("brands")
      .select("id,official_name,short_name,domain,business_type,business_stage,stage_label,primary_marketing_goal,campaign_phase,tagline,short_description,differentiator,active")
      .eq("active", true)
      .order("official_name");

    if (error) throw error;

    state.brands = Array.isArray(data) ? data : [];
    els.brand.innerHTML = "";

    if (!state.brands.length) {
      els.brand.innerHTML = "<option value=''>No accessible brands</option>";
      say("No active Marketing Studio brands are available to this signed-in account.", "error");
      return;
    }

    for (const brand of state.brands) {
      const option = document.createElement("option");
      option.value = brand.id;
      option.textContent = brandName(brand);
      els.brand.appendChild(option);
    }

    const saved = getStored(STORAGE_ACTIVE_BRAND);
    const active = state.brands.find(brand => brand.id === saved) || state.brands[0];
    els.brand.value = active.id;
    state.brand = active;
    setStored(STORAGE_ACTIVE_BRAND, active.id);
    restoreRunForBrand();
    await loadBrainSummary();
    setBusy(false);
    say("Campaign Forge is connected to " + brandName(active) + ".", "ok");
  }

  function restoreRunForBrand() {
    state.runId = state.brand ? getStored(RUN_PREFIX + state.brand.id) : null;
    state.handoff = "";
    els.replyCard.hidden = true;
    if (state.runId) {
      els.handoffPanel.hidden = false;
      els.handoffTitle.textContent = "Forge request already recorded";
      els.handoffBadge.textContent = "Waiting";
      els.handoffText.textContent = "A Campaign Forge request is already recorded for this brand. If you already sent it to ChatGPT, check for the returned reply. If you never sent it, start a new forge.";
      els.shareButton.hidden = true;
      els.copyButton.hidden = true;
      els.checkButton.hidden = false;
    } else {
      els.handoffPanel.hidden = true;
      els.shareButton.hidden = false;
      els.copyButton.hidden = false;
      els.checkButton.hidden = false;
    }
  }

  els.brand.addEventListener("change", async () => {
    state.brand = state.brands.find(brand => brand.id === els.brand.value) || null;
    if (!state.brand) return;
    setStored(STORAGE_ACTIVE_BRAND, state.brand.id);
    restoreRunForBrand();
    setBusy(false);
    say("Working brand changed to " + brandName(state.brand) + ".", "info");
    await loadBrainSummary();
  });

  function forgeRequest(inputs) {
    const urlLine = inputs.url
      ? "Public destination to inspect: " + inputs.url + "\n"
      : "No destination URL was supplied. Use the live Brand Brain and the offer/context below.\n";

    return [
      "CAMPAIGN FORGE V1",
      "",
      "Build and SAVE a coordinated draft marketing campaign for the exact BSMS brand in this request.",
      "This is an owner-initiated draft-creation request. Do not publish, schedule, send, boost, alter ad budgets, or spend money.",
      "",
      "Required workflow:",
      "1. Call get_brand_brain for brand_id " + inputs.brandId + " and use its identity, voice, facts, guardrails, audiences, products/services, milestones, and learned marketing feedback.",
      "2. Call list_campaigns for the same brand and avoid creating an accidental duplicate of an existing campaign.",
      "3. " + urlLine.trim(),
      "4. Develop 5 materially different hooks and 3 materially different campaign concepts. Do not merely paraphrase the same angle.",
      "5. Choose the strongest concept for the requested goal and channels.",
      "6. Build the campaign package: offer, audience direction, primary message, CTA, creative direction, and channel notes.",
      "7. Use create_marketing_plan to save EXACTLY one draft campaign plus " + inputs.draftCount + " useful draft content item(s). The saved content should represent distinct angles or placements, not duplicate copy.",
      "8. Do not create calendar items or an asset folder unless they are genuinely necessary to the campaign request. Do not schedule anything.",
      "9. After the save is confirmed, return a concise summary naming the campaign, the saved draft content items, the winning angle, all 5 hooks, the 3 concepts, audience direction, CTA, and the best next manual step.",
      "",
      "Campaign inputs:",
      "Brand: " + inputs.brandName,
      "Goal: " + inputs.goalLabel,
      "Preferred angle: " + inputs.angleLabel,
      "Channels: " + inputs.channels.join(", "),
      "Offer/context: " + (inputs.offer || "(Use the public destination and Brand Brain.)"),
      "Extra guardrail: " + (inputs.notes || "(none)"),
      inputs.url ? "Landing/product URL: " + inputs.url : "",
      "",
      "If the public destination conflicts with verified or owner-approved Brand Brain facts, the Brand Brain wins. If a critical fact is missing, make a conservative draft assumption and label it in the returned summary rather than inventing certainty."
    ].filter(Boolean).join("\n");
  }

  function handoffPrompt(requestText, context, returnLane) {
    const delivery = {
      tool: "Black Stag Marketing Studio / submit_ember_reply",
      request_id: returnLane.request_id,
      brand_id: context.brand.id
    };

    return [
      "@Black Stag Marketing Studio",
      "",
      "Campaign Forge handoff from Black Stag Marketing Studio. This request was prepared by the signed-in owner through the Studio app.",
      "Use the connected Black Stag Marketing Studio tools for live brand reads and supported draft writes. Use web access only when a public destination URL is included.",
      "Do not publish, send, schedule, boost, alter budgets, or spend money. Never claim a Studio save succeeded unless the connected tool confirms it.",
      "",
      "BSMS_CAMPAIGN_FORGE_PAYLOAD",
      JSON.stringify(context, null, 2),
      "",
      "OWNER_INSTRUCTION",
      requestText,
      "",
      "BSMS_AUTHENTICATED_REPLY",
      JSON.stringify(delivery, null, 2),
      "",
      "After completing the Campaign Forge workflow, call the connected Black Stag Marketing Studio tool submit_ember_reply with exactly that request_id and brand_id and a useful plain-language response_text summarizing the confirmed outcome. Only the reply should be written through the return tool. The campaign/content drafts themselves must be created through create_marketing_plan."
    ].join("\n");
  }

  async function functionErrorMessage(error) {
    let message = error?.message || "Unable to prepare Campaign Forge.";
    if (error?.context && typeof error.context.json === "function") {
      try {
        const payload = await error.context.json();
        message = payload?.message || payload?.error || message;
      } catch {}
    }
    return message;
  }

  async function prepareForge(event) {
    event.preventDefault();
    if (!state.brand || state.busy) return;

    const urlRaw = els.landingUrl.value.trim();
    const url = normalizeUrl(urlRaw);
    if (urlRaw && !url) {
      say("That destination URL does not look valid.", "error");
      els.landingUrl.focus();
      return;
    }

    const offer = els.offer.value.trim();
    if (!offer && !url) {
      say("Give the Forge either an offer/context or a destination URL.", "error");
      els.offer.focus();
      return;
    }

    const channels = selectedChannels();
    if (!channels.length) {
      say("Choose at least one campaign channel.", "error");
      return;
    }

    const inputs = {
      brandId: state.brand.id,
      brandName: brandName(state.brand),
      url,
      offer,
      goal: els.goal.value,
      goalLabel: goalLabels[els.goal.value] || els.goal.value,
      angle: els.angle.value,
      angleLabel: angleLabels[els.angle.value] || els.angle.value,
      channels,
      draftCount: Math.max(1, Math.min(5, Number(els.draftCount.value) || 3)),
      notes: els.notes.value.trim()
    };

    const requestText = forgeRequest(inputs);
    const context = {
      schema: "bsms.campaign_forge.v1",
      source: "campaign_forge",
      created_at: new Date().toISOString(),
      brand: {
        id: state.brand.id,
        name: state.brand.official_name || null,
        short_name: state.brand.short_name || null,
        domain: state.brand.domain || null
      },
      inputs: {
        landing_url: inputs.url || null,
        offer: inputs.offer || null,
        goal: inputs.goal,
        angle: inputs.angle,
        channels: inputs.channels,
        content_draft_count: inputs.draftCount,
        extra_guardrail: inputs.notes || null
      },
      requested_write: {
        tool: "create_marketing_plan",
        campaign_count: 1,
        content_draft_count: inputs.draftCount,
        draft_only: true,
        no_publish: true,
        no_schedule: true,
        no_spend: true
      }
    };

    setBusy(true);
    say("Securing the Campaign Forge request and preparing its return path…", "info");

    try {
      const { data, error } = await state.client.functions.invoke("prepare-ember-handoff", {
        body: {
          brand_id: state.brand.id,
          request_text: requestText,
          request_context: context
        }
      });

      if (error) throw new Error(await functionErrorMessage(error));

      if (
        !data?.ok ||
        typeof data.run_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(data.run_id) ||
        typeof data.return_capability !== "string" ||
        !/^[0-9a-f]{64}$/i.test(data.return_capability)
      ) {
        throw new Error("Studio did not return a valid Campaign Forge handoff.");
      }

      state.runId = data.run_id;
      state.handoff = handoffPrompt(requestText, context, {
        request_id: data.run_id,
        return_capability: data.return_capability
      });

      setStored(RUN_PREFIX + state.brand.id, state.runId);

      els.handoffPanel.hidden = false;
      els.replyCard.hidden = true;
      els.handoffTitle.textContent = "Campaign Forge is ready";
      els.handoffBadge.textContent = "Ready";
      els.handoffText.textContent = "Send this request to ChatGPT. Ember will read the live brand, forge the campaign, save the draft plan through BSMS, and return a confirmed summary here.";
      els.shareButton.hidden = false;
      els.copyButton.hidden = false;
      els.checkButton.hidden = false;
      say("Forge prepared. Send it to ChatGPT, then come back here to check the result.", "ok");
    } catch (error) {
      state.handoff = "";
      state.runId = null;
      say(error?.message || "Campaign Forge could not prepare the handoff.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function shareHandoff() {
    if (!state.handoff) {
      say("Prepare a new Campaign Forge request first.", "error");
      return;
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Black Stag Campaign Forge → Ember",
          text: state.handoff
        });
        say("Handoff shared. Send it in ChatGPT, then return here and check for the reply.", "ok");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    await copyHandoff();
  }

  async function copyHandoff() {
    if (!state.handoff) {
      say("Prepare a new Campaign Forge request first.", "error");
      return;
    }
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(state.handoff);
      say("Campaign Forge handoff copied. Paste and send it in ChatGPT.", "ok");
    } catch {
      say("Clipboard access is unavailable here. Use Share to ChatGPT instead.", "error");
    }
  }

  async function checkReply() {
    if (!state.runId || !state.brand || state.busy) {
      say("There is no Campaign Forge request to check yet.", "info");
      return;
    }

    setBusy(true);
    els.handoffBadge.textContent = "Checking";
    say("Checking Studio for Ember's Campaign Forge reply…", "info");

    try {
      const { data, error } = await state.client
        .from("ember_agent_runs")
        .select("id,brand_id,status,response_text,error_text")
        .eq("id", state.runId)
        .eq("brand_id", state.brand.id)
        .single();

      if (error) throw error;

      if (data.status === "answered" && data.response_text) {
        els.handoffTitle.textContent = "Campaign forged";
        els.handoffBadge.textContent = "Returned";
        els.handoffText.textContent = "Ember returned the confirmed Campaign Forge result. Review the summary below, then open Campaigns or Content Studio.";
        els.replyText.textContent = data.response_text;
        els.replyCard.hidden = false;
        els.shareButton.hidden = true;
        els.copyButton.hidden = true;
        setStored(RUN_PREFIX + state.brand.id, state.runId);
        say("Campaign Forge returned successfully.", "ok");
      } else if (data.status === "failed" || data.status === "cancelled") {
        els.handoffBadge.textContent = "Needs attention";
        say(data.error_text || "This Campaign Forge request did not complete.", "error");
      } else {
        els.handoffBadge.textContent = "Waiting";
        say("Still waiting for the ChatGPT return. If you just sent it, check again after the reply is submitted.", "info");
      }
    } catch (error) {
      els.handoffBadge.textContent = "Error";
      say(error?.message || "Could not check the Campaign Forge return lane.", "error");
    } finally {
      setBusy(false);
    }
  }

  function startNewForge() {
    if (state.brand) setStored(RUN_PREFIX + state.brand.id, null);
    state.runId = null;
    state.handoff = "";
    els.handoffPanel.hidden = true;
    els.replyCard.hidden = true;
    els.shareButton.hidden = false;
    els.copyButton.hidden = false;
    els.handoffBadge.textContent = "Ready";
    setBusy(false);
    say("Campaign Forge is ready for a new draft.", "ok");
    els.offer.focus();
  }

  function clearForm() {
    els.landingUrl.value = "";
    els.offer.value = "";
    els.notes.value = "";
    els.goal.value = "leads";
    els.angle.value = "balanced";
    els.draftCount.value = "3";
    document.querySelectorAll('input[name="channels"]').forEach(input => {
      input.checked = input.value === "Facebook" || input.value === "Instagram";
    });
    say("Forge inputs cleared.", "info");
  }

  els.form.addEventListener("submit", prepareForge);
  els.shareButton.addEventListener("click", shareHandoff);
  els.copyButton.addEventListener("click", copyHandoff);
  els.checkButton.addEventListener("click", checkReply);
  els.newButton.addEventListener("click", startNewForge);
  els.clearButton.addEventListener("click", clearForm);

  async function init() {
    if (!window.supabase?.createClient || !config.url || !(config.publishableKey || config.anonKey)) {
      say("Campaign Forge could not load the Marketing Studio connection.", "error");
      return;
    }

    state.client = window.supabase.createClient(
      config.url,
      config.publishableKey || config.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    const { data: sessionData } = await state.client.auth.getSession();
    if (!sessionData?.session) {
      say("Sign in to Black Stag Marketing Studio first, then reopen Campaign Forge.", "error");
      return;
    }

    try {
      await loadBrands();
    } catch (error) {
      say(error?.message || "Campaign Forge could not load your Studio brands.", "error");
    }
  }

  init();
})();
