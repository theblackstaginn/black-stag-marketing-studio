/* Black Stag Marketing Studio | Finance Desk
 * Read-only foundation. Reads ONLY owner-scoped brand and existing Asset Vault metadata.
 * No bank connection, payment capabilities, local financial storage, or ledger writes.
 */
"use strict";
(() => {
  const STAG_AND_STONE = "f2d4ad11-da97-4ede-bd8c-135150cf9ef6";
  const ACTIVE_BRAND_KEY = "blackStagMarketingStudio.activeBrand";
  const $ = id => document.getElementById(id);
  const state = { client: null, owner: null, brands: [], brandId: null, loading: false };

  function showGate(message, error = false) {
    const gate = $("gate");
    gate.textContent = message;
    gate.className = "notice" + (error ? " error" : "");
    gate.hidden = false;
    $("workspace").hidden = true;
  }

  function setStatus(message, error = false) {
    $("syncStatus").textContent = message;
    $("syncStatus").className = "sync-status" + (error ? " error" : "");
  }

  function amountInCents(raw) {
    if (typeof raw !== "string" || !/^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$/.test(raw)) return null;
    const value = Number(raw.replaceAll(",", ""));
    return Number.isSafeInteger(Math.round(value * 100)) && value >= 0 ? Math.round(value * 100) : null;
  }

  // This description is a private existing Asset Vault record, not a live bank feed.
  // Reject partial matches or mismatched arithmetic; never fabricate a numeric total.
  function readBudgetSnapshot(description) {
    const source = String(description || "");
    const matched = source.match(/Baseline WCW estimate:\s*\$([\d,]+\.\d{2})\s+food\s+plus\s+\$([\d,]+\.\d{2})\s+selected packaging\s*\(\$([\d,]+\.\d{2})\s+total\)/i);
    if (!matched) return null;
    const [food, packaging, total] = matched.slice(1).map(amountInCents);
    if ([food, packaging, total].some(n => n === null) || food + packaging !== total) return null;
    return { food, packaging, total };
  }

  function money(cents) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function driveLink(raw) {
    if (!raw || typeof raw !== "string") return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname)) return null;
      return url.href;
    } catch { return null; }
  }

  function clearBudget() {
    for (const id of ["plannedTotal", "plannedFood", "plannedPackaging"]) $(id).textContent = "—";
    $("budgetTitle").textContent = "No verified budget found";
    $("budgetStatus").textContent = "The private Asset Vault has no matching verified opening budget for this business.";
    $("openBudget").hidden = true;
    $("openBudget").removeAttribute("href");
  }

  async function refresh() {
    if (state.loading || !state.brandId) return;
    state.loading = true;
    $("refresh").disabled = true;
    clearBudget();
    $("budgetStatus").textContent = "Checking the private Asset Vault…";
    setStatus("Loading owner-approved source records…");
    try {
      const { data, error } = await state.client.from("assets")
        .select("name,description,external_url,updated_at")
        .eq("brand_id", state.brandId)
        .eq("asset_type", "document")
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const source = (data || []).find(item => /^Fall 2026 Opening Inventory\s*[—-]\s*WCW Verified Budget$/i.test(item.name || ""));
      if (!source) {
        setStatus("No verified WCW budget is linked to this business yet.");
        return;
      }
      $("budgetTitle").textContent = source.name;
      const snapshot = readBudgetSnapshot(source.description);
      if (snapshot) {
        $("plannedTotal").textContent = money(snapshot.total);
        $("plannedFood").textContent = money(snapshot.food);
        $("plannedPackaging").textContent = money(snapshot.packaging);
        $("budgetStatus").textContent = "Source: saved budget record. Planning estimate only; verify changes in the master workbook.";
      } else {
        $("budgetStatus").textContent = "Budget linked, but its summary could not be verified. Open the workbook for the actual numbers.";
      }
      const link = driveLink(source.external_url);
      if (link) {
        $("openBudget").href = link;
        $("openBudget").hidden = false;
      }
      setStatus("Finance planning records refreshed. No live bank data is connected.");
    } catch {
      clearBudget();
      $("budgetStatus").textContent = "Could not read the private budget record. No amounts are being displayed.";
      setStatus("Budget refresh failed. Check your session or try again.", true);
    } finally {
      state.loading = false;
      $("refresh").disabled = false;
    }
  }

  function changeBrand(brandId) {
    if (!state.brands.some(b => b.id === brandId)) return;
    state.brandId = brandId;
    $("accountHeading").textContent = "Bank account · not connected";
    $("accountDescription").textContent = "No business bank account is connected for this brand. All banking data is unavailable.";
    $("availableCash").textContent = "Unavailable";
    refresh();
  }

  async function initialize() {
    const conf = window.BLACK_STAG_CONFIG?.supabase || {};
    if (!window.supabase?.createClient || !conf.url || !conf.publishableKey) {
      showGate("Studio configuration unavailable. Return to Marketing Studio and try again.", true);
      return;
    }
    state.client = window.supabase.createClient(conf.url, conf.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    state.client.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        state.owner = null;
        clearBudget();
        showGate("Session ended. Sign in to Marketing Studio to access the Finance Desk.", true);
      }
    });
    try {
      const { data: userResult, error: authError } = await state.client.auth.getUser();
      if (authError || !userResult?.user) throw new Error("Sign in to Marketing Studio first, then reopen Finance Desk.");
      state.owner = userResult.user.id;
      const { data: brands, error } = await state.client.from("brands")
        .select("id,official_name,short_name,owner_id")
        .eq("owner_id", state.owner)
        .order("official_name");
      if (error || !brands?.length) throw new Error("No privately owned Studio brands are available for this account.");
      state.brands = brands.filter(brand => brand.owner_id === state.owner);
      if (!state.brands.length) throw new Error("You do not have owner access to these business records.");
      const select = $("brandSelect");
      for (const brand of state.brands) {
        const option = document.createElement("option");
        option.value = brand.id;
        option.textContent = brand.short_name || brand.official_name || "Unnamed business";
        select.appendChild(option);
      }
      let preferred = "";
      try { preferred = window.localStorage.getItem(ACTIVE_BRAND_KEY) || ""; } catch { /* optional preference */ }
      const initial = state.brands.find(b => b.id === preferred)?.id
        || state.brands.find(b => b.id === STAG_AND_STONE)?.id
        || state.brands[0].id;
      select.value = initial;
      $("gate").hidden = true;
      $("workspace").hidden = false;
      select.addEventListener("change", () => changeBrand(select.value));
      $("refresh").addEventListener("click", refresh);
      changeBrand(initial);
    } catch (error) {
      showGate(error?.message || "Could not verify owner access for Finance Desk.", true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else { initialize(); }
})();