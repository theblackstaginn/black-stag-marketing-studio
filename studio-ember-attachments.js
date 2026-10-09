"use strict";
/* Owner-selected image references for the existing Ask Ember handoff.
   Image bytes stay in private brand-assets storage, not the ChatGPT prompt. */
window.BlackStagEmberAttachments = (() => {
  const maxFiles = 6, maxBytes = 12 * 1024 * 1024;
  const state = {brandId: "", items: [], busy: false};
  let nextId = 0;

  const escape = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function clear() {
    for (const item of state.items) if (item.preview) URL.revokeObjectURL(item.preview);
    state.items = [];
  }
  function reset(brandId, force = false) {
    if (force || state.brandId !== String(brandId || "")) {
      clear(); state.brandId = String(brandId || ""); state.busy = false;
    }
  }
  function options(brand) {
    return (APP_DATA.assets || []).filter(asset =>
      asset.active !== false && String(asset.brandId) === String(brand.id) &&
      !!asset.storageBucket && !!asset.storagePath &&
      (String(asset.mimeType || "").startsWith("image/") ||
        ["photo", "logo", "generated_artwork", "brand_asset"].includes(asset.category))
    ).sort((a,b) => String(a.name || "").localeCompare(String(b.name || "")));
  }
  function references(brand) {
    reset(brand.id);
    return state.items.filter(x => x.assetId).map(x => ({
      asset_id: x.assetId, name: x.name,
      source: x.source === "vault" ? "asset_vault" : "device_upload"
    }));
  }
  function render(brand, locked = false) {
    reset(brand.id);
    const disabled = locked || state.busy || state.items.length >= maxFiles;
    const selected = new Set(state.items.map(x => String(x.assetId || "")));
    const vault = options(brand).filter(x => !selected.has(String(x.id)))
      .map(x => "<option value='" + escape(x.id) + "'>" + escape(x.name) + "</option>").join("");
    const cards = state.items.map(x => {
      const asset = options(brand).find(a => String(a.id) === String(x.assetId));
      const url = x.preview || (asset ? getAssetDisplayUrl(asset) : "");
      return "<div class='ember-reference-card'>" +
        (url ? "<img src='" + escape(url) + "' alt='Reference thumbnail'>" : "<span aria-hidden='true'>▣</span>") +
        "<div><strong>" + escape(x.name) + "</strong><small>" +
        (x.source === "vault" ? "Asset Vault" : (x.assetId ? "Stored privately" : "Ready to attach")) +
        "</small></div>" +
        (!locked && !state.busy ? "<button class='text-button' type='button' data-ember-reference-remove='" +
          escape(x.localId) + "'>Remove</button>" : "") + "</div>";
    }).join("");
    return "<section id='emberReferencePanel' class='ember-reference-panel'>" +
      "<div class='ember-reference-heading'><strong>Attach reference images</strong><small>" +
      state.items.length + " / " + maxFiles + "</small></div>" +
      "<div class='ember-reference-pickers'>" +
      "<label class='ember-reference-upload'><span aria-hidden='true'>📎</span> Photos / Files" +
      "<input id='emberReferenceFiles' type='file' accept='image/*,.heic,.heif' multiple" +
      (disabled ? " disabled" : "") + "></label>" +
      "<label class='field'><span>Or choose from Asset Vault</span><select id='emberReferenceVault'" +
      (disabled ? " disabled" : "") +
      "><option value=''>Select an image…</option>" + vault + "</select></label></div>" +
      (cards ? "<div class='ember-reference-items'>" + cards + "</div>" : "") +
      "<p class='muted-copy'>Up to 6 photos (12 MB each). Device photos are stored privately in " +
      "this brand's Asset Vault when preparing the request so Ember can actually view them. " +
      "They will not be approved or published automatically.</p></section>";
  }
  function repaint() {
    const panel = document.getElementById("emberReferencePanel");
    const brand = getActiveBrand();
    if (!panel || !brand) return;
    const locked = !!document.querySelector("[data-ember-chat-send]")?.disabled;
    panel.outerHTML = render(brand, locked);
  }
  function addFiles(files) {
    const brand = getActiveBrand();
    if (!brand || state.busy) return;
    reset(brand.id);
    for (const file of Array.from(files || [])) {
      if (state.items.length >= maxFiles) { showToast("Maximum six images.", "info"); break; }
      if (!(/^(image\/jpeg|image\/png|image\/webp|image\/heic|image\/heif)$/i.test(file.type) ||
          /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name))) {
        showToast("Choose a JPG, PNG, WebP, or iPhone photo.", "error"); continue;
      }
      if (!file.size || file.size > maxBytes) {
        showToast("Each image must be 12 MB or less.", "error"); continue;
      }
      state.items.push({localId: String(++nextId), source: "device", name: file.name,
        assetId: null, file, preview: URL.createObjectURL(file)});
    }
    repaint();
  }
  function addVault(id) {
    const brand = getActiveBrand();
    if (!brand || state.busy) return;
    reset(brand.id);
    if (state.items.length >= maxFiles) return;
    const asset = options(brand).find(x => String(x.id) === String(id));
    if (!asset || state.items.some(x => x.assetId === String(id))) return;
    state.items.push({localId: String(++nextId), source: "vault",
      name: asset.name, assetId: String(asset.id), file: null, preview: ""});
    repaint();
  }
  function remove(id) {
    if (state.busy) return;
    const n = state.items.findIndex(x => x.localId === id);
    if (n < 0) return;
    const [removed] = state.items.splice(n, 1);
    if (removed.preview) URL.revokeObjectURL(removed.preview);
    repaint();
  }
  async function jpegFromIphone(file) {
    if (!(/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name))) return file;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve,reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Cannot decode this HEIC photo. Choose a JPEG or PNG copy."));
        image.src = url;
      });
      const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("HEIC photo conversion failed.");
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, "") + ".jpg",
        {type: "image/jpeg"});
    } finally { URL.revokeObjectURL(url); }
  }
  async function prepare(brand) {
    reset(brand.id);
    if (state.busy) throw new Error("Images are already uploading.");
    if (!state.items.length) return [];
    if (!APP_STATE.user?.id) throw new Error("Please sign in before attaching images.");
    state.busy = true; repaint();
    try {
      for (const item of state.items) {
        if (item.assetId) continue;
        const file = await jpegFromIphone(item.file);
        if (!["image/jpeg","image/png","image/webp"].includes(file.type) ||
            !file.size || file.size > maxBytes) {
          throw new Error("The selected photo cannot be uploaded as a JPG, PNG, or WebP.");
        }
        const bucket = "brand-assets";
        const path = createAssetStoragePath(file, brand);
        const uploaded = await supabaseClient.storage.from(bucket).upload(path, file,
          {upsert: false, cacheControl: "3600", contentType: file.type});
        if (uploaded.error) throw uploaded.error;
        let row;
        try {
          const inserted = await supabaseClient.from("assets").insert({
            brand_id: brand.id, folder_id: null,
            name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0,160),
            asset_type: "photo", description: "User-provided Ask Ember reference; not approved for marketing.",
            storage_bucket: bucket, storage_path: path, external_url: null,
            mime_type: file.type, alt_text: null,
            tags: ["ember-reference", "owner-provided"],
            approved_for_ai: true, approved_for_marketing: false, active: true
          }).select("*").single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
          if (!row?.id) throw new Error("Asset Vault did not confirm the upload.");
        } catch (err) {
          try { await supabaseClient.storage.from(bucket).remove([path]); } catch {}
          throw err;
        }
        const asset = normalizeAsset(row);
        item.assetId = String(asset.id);
        item.file = null;
        try { await hydrateAssetSignedUrls([asset]); } catch {}
        APP_DATA.assets = (APP_DATA.assets || []).filter(x => String(x.id) !== String(asset.id));
        APP_DATA.assets.unshift(asset);
      }
      return references(brand);
    } finally { state.busy = false; repaint(); }
  }
  document.addEventListener("change", e => {
    if (e.target?.id === "emberReferenceFiles") addFiles(e.target.files);
    if (e.target?.id === "emberReferenceVault" && e.target.value) addVault(e.target.value);
  }, true);
  document.addEventListener("click", e => {
    const btn = e.target.closest?.("[data-ember-reference-remove]");
    if (btn) { e.preventDefault(); remove(btn.dataset.emberReferenceRemove); }
  }, true);
  return {render, reset, prepare, references};
})();