/* Black Stag Marketing Studio | Lead to Revenue Desk
 * Owner-only browser client over the existing RLS-protected black_stag_leads table.
 * No automated contact, publishing, spending, or third-party event collection.
 */
"use strict";
(() => {
  const BRAND_ID = "d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
  const STAGES = ["new", "contacted", "qualified", "quoted", "won", "lost", "spam"];
  const ACTIVE = new Set(["contacted", "qualified", "quoted"]);
  const DONE = new Set(["won", "lost", "spam"]);
  const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
  const LIMIT = 200;
  const $ = id => document.getElementById(id);
  const state = { client: null, leads: [], busy: false, ownerId: null };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function showGate(message, kind = "") {
    const gate = $("gate");
    gate.textContent = message;
    gate.className = "notice" + (kind ? " " + kind : "");
    gate.hidden = false;
  }

  function say(message, kind = "") {
    const node = $("syncStatus");
    node.textContent = message;
    node.className = kind ? kind : "";
  }

  function prettyDate(value) {
    const date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit"
    }).format(date);
  }

  function daysOld(value, now = Date.now()) {
    const time = new Date(value || "").getTime();
    return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 86400000)) : null;
  }

  function needsAction(lead, now = Date.now()) {
    if (lead.status === "new") return true;
    if (!ACTIVE.has(lead.status)) return false;
    const updated = new Date(lead.updated_at || lead.created_at || "").getTime();
    return Number.isFinite(updated) && now - updated >= STALE_AFTER_MS;
  }

  function safeWebsite(value) {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw || raw.length > 500) return "";
    try {
      const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : "https://" + raw);
      if (!["https:", "http:"].includes(u.protocol) || !u.hostname) return "";
      return u.href;
    } catch { return ""; }
  }

  function counts(leads) {
    const byStage = Object.fromEntries(STAGES.map(s => [s, 0]));
    let actionCount = 0;
    for (const lead of leads) {
      if (Object.prototype.hasOwnProperty.call(byStage, lead.status)) byStage[lead.status]++;
      if (needsAction(lead)) actionCount++;
    }
    return {
      byStage,
      action: actionCount,
      active: byStage.contacted + byStage.qualified + byStage.quoted
    };
  }

  function renderMetrics(leads) {
    const c = counts(leads);
    $("statNew").textContent = String(c.byStage.new);
    $("statDue").textContent = String(c.action);
    $("statActive").textContent = String(c.active);
    $("statWon").textContent = String(c.byStage.won);
    const funnel = $("funnel");
    funnel.replaceChildren();
    const stages = [
      ["new", "New"], ["contacted", "Contacted"],
      ["qualified", "Qualified"], ["quoted", "Quoted"],
      ["won", "Won"], ["lost", "Lost"], ["spam", "Spam/test"]
    ];
    for (const [key, label] of stages) {
      const cell = element("div", "funnel-cell stage-" + key);
      const value = element("strong", "", String(c.byStage[key]));
      const name = element("span", "", label);
      cell.append(value, name);
      funnel.append(cell);
    }
  }

  function priority(lead) {
    if (lead.status === "new") return 0;
    if (needsAction(lead)) return 1;
    if (ACTIVE.has(lead.status)) return 2;
    return 3;
  }

  function appendContactLink(holder, kind, value) {
    if (!value || typeof value !== "string") return;
    if (kind === "email") {
      const clean = value.trim().slice(0, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return;
      const a = element("a", "contact-link", "✉ Email");
      a.href = "mailto:" + clean + "?subject=" +
        encodeURIComponent("Black Stag Web Design | Your website checkup");
      a.rel = "noreferrer";
      holder.append(a);
      return;
    }
    if (kind === "phone" || kind === "text") {
      const phone = value.replace(/[^0-9+]/g, "").slice(0, 25);
      if (phone.replace(/\D/g, "").length < 7) return;
      const link = element("a", "contact-link", kind === "text" ? "✎ Text" : "☎ Call");
      link.href = (kind === "text" ? "sms:" : "tel:") + phone;
      holder.append(link);
      return;
    }
    if (kind === "website") {
      const href = safeWebsite(value);
      if (!href) return;
      const a = element("a", "contact-link", "↗ View website");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      holder.append(a);
    }
  }

  async function saveStage(lead, chosen, button, feedback) {
    if (!STAGES.includes(chosen) || chosen === lead.status || state.busy) return;
    if (DONE.has(chosen) &&
        !window.confirm("Mark this lead as " + chosen.toUpperCase() +
          "? This updates the private lead record, not any invoice or payment.")) return;

    state.busy = true;
    button.disabled = true;
    feedback.textContent = "Saving…";
    try {
      const { data, error } = await state.client.from("black_stag_leads")
        .update({ status: chosen, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("brand_id", BRAND_ID)
        .select("id,status,updated_at")
        .single();
      if (error || !data || data.id !== lead.id || data.status !== chosen) {
        throw new Error("Unable to confirm that the stage was updated.");
      }
      state.leads = state.leads.map(row =>
        row.id === lead.id ? { ...row, ...data } : row
      );
      render();
      say("Stage saved. Linked Studio work-item status is managed separately.", "success");
    } catch {
      feedback.textContent = "Save failed. Refresh and try again.";
      say("Could not save the stage. Your record was not confirmed updated.", "error");
      button.disabled = false;
    } finally { state.busy = false; }
  }

  function renderCard(lead) {
    const card = element("article", "lead-card stage-" + lead.status);
    card.setAttribute("role", "listitem");
    const top = element("div", "lead-top");
    const identity = element("div", "lead-identity");
    const business = element("h3", "", lead.business_name || "Unnamed business");
    const person = element("p", "muted", "Contact: " + (lead.name || "Unknown"));
    const status = element("span", "status-pill status-" + lead.status, lead.status);
    identity.append(business, person);
    top.append(identity, status);
    card.append(top);

    const notes = element("div", "lead-meta");
    notes.append(element("span", "", "Received " + prettyDate(lead.created_at)));
    const age = daysOld(lead.created_at);
    if (age !== null) notes.append(element("span", "", age + " day" + (age === 1 ? "" : "s") + " old"));
    if (lead.primary_need) notes.append(element("span", "", "Need: " + lead.primary_need));
    if (lead.contact_preference) notes.append(element("span", "", "Preferred contact: " + lead.contact_preference));
    if (lead.utm_source || lead.utm_campaign) {
      notes.append(element("span", "", "Source: " +
        [lead.utm_source, lead.utm_campaign].filter(Boolean).join(" / ")));
    } else {
      notes.append(element("span", "", "Source: website checkup"));
    }
    card.append(notes);
    if (lead.message) {
      const details = element("details", "lead-note");
      const summary = element("summary", "", "Read submitted message");
      const p = element("p", "", lead.message);
      details.append(summary, p);
      card.append(details);
    }

    const actions = element("div", "contact-actions");
    // Honor the contact preference chosen in the original consented request.
    const preference = lead.contact_preference || "either";
    if (preference === "email" || preference === "either") {
      appendContactLink(actions, "email", lead.email);
    }
    if (preference === "phone" || preference === "either") {
      appendContactLink(actions, "phone", lead.phone);
    }
    if (preference === "text") {
      appendContactLink(actions, "text", lead.phone);
    }
    appendContactLink(actions, "website", lead.website_url);
    if (actions.children.length) card.append(actions);

    const flag = element("p", "lead-flag", lead.status === "new" ?
      "New inquiry · review and respond promptly." :
      needsAction(lead) ?
        "Follow-up suggested · no activity recorded in this stage for 48+ hours." :
        DONE.has(lead.status) ?
          "Closed stage · no follow-up currently suggested." :
          "In progress · update after your next conversation.");
    card.append(flag);

    const controls = element("div", "stage-controls");
    const label = element("label", "field-label", "Pipeline stage");
    const select = element("select", "stage-select");
    select.id = "stage-" + lead.id;
    label.htmlFor = select.id;
    for (const key of STAGES) {
      const option = element("option", "", key === "spam" ? "Spam / test" :
        key.charAt(0).toUpperCase() + key.slice(1));
      option.value = key;
      option.selected = key === lead.status;
      select.append(option);
    }
    const save = element("button", "save-stage", "Save stage");
    save.type = "button";
    save.disabled = true;
    const feedback = element("span", "save-feedback");
    feedback.setAttribute("role", "status");
    select.addEventListener("change", () => {
      save.disabled = state.busy || select.value === lead.status;
      feedback.textContent = "";
    });
    save.addEventListener("click", () => saveStage(lead, select.value, save, feedback));
    controls.append(label, select, save, feedback);
    card.append(controls);
    return card;
  }

  function render() {
    const sorted = [...state.leads].sort((a, b) =>
      priority(a) - priority(b) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const filter = $("filter").value;
    const visible = sorted.filter(lead => {
      if (filter === "all") return true;
      if (filter === "action") return needsAction(lead);
      return lead.status === filter;
    });
    renderMetrics(state.leads);
    $("queueCount").textContent = visible.length + " of " + state.leads.length +
      " recent inquiries shown. Suggested follow-up is not a scheduled reminder.";
    $("queueEmpty").hidden = visible.length > 0;
    const queue = $("leadQueue");
    queue.replaceChildren();
    for (const lead of visible) queue.append(renderCard(lead));
  }

  async function refresh() {
    if (state.busy) return;
    state.busy = true;
    $("refresh").disabled = true;
    say("Refreshing the private pipeline…");
    try {
      const { data, error } = await state.client.from("black_stag_leads")
        .select("id,brand_id,name,business_name,email,phone,website_url,contact_preference,primary_need,message,source,utm_source,utm_medium,utm_campaign,utm_content,landing_path,status,consent_to_contact,created_at,updated_at")
        .eq("brand_id", BRAND_ID)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error || !Array.isArray(data)) throw new Error("Failed to read RLS-protected leads");
      state.leads = data.filter(x => x.brand_id === BRAND_ID && STAGES.includes(x.status));
      render();
      say("Updated " + prettyDate(new Date().toISOString()) +
        ". Lead statuses are manual; no clients have been contacted automatically.", "success");
    } catch {
      say("Leads could not be loaded. Check your session and try again.", "error");
    } finally {
      state.busy = false;
      $("refresh").disabled = false;
    }
  }

  async function initialize() {
    const conf = window.BLACK_STAG_CONFIG?.supabase || {};
    if (!window.supabase?.createClient || !conf.url || !conf.publishableKey) {
      showGate("Studio configuration is unavailable. Please reopen from Marketing Studio.", "error");
      return;
    }
    state.client = window.supabase.createClient(conf.url, conf.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    try {
      const { data: userData, error: authError } = await state.client.auth.getUser();
      if (authError || !userData?.user) {
        throw new Error("Sign in to Marketing Studio first, then return to this private desk.");
      }
      const { data: brand, error } = await state.client.from("brands")
        .select("id,owner_id").eq("id", BRAND_ID).maybeSingle();
      if (error || !brand || brand.owner_id !== userData.user.id) {
        throw new Error("This desk is restricted to the primary Black Stag Web Design owner.");
      }
      state.ownerId = userData.user.id;
      $("gate").hidden = true;
      $("workspace").hidden = false;
      $("refresh").addEventListener("click", refresh);
      $("filter").addEventListener("change", render);
      await refresh();
    } catch (e) {
      showGate(e?.message || "Unable to verify access to the private lead desk.", "error");
      $("workspace").hidden = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else { initialize(); }
})();
