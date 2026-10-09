# Ask Ember: image attachments

## Purpose
Owners can add up to six reference images to an Ask Ember request. Sources are the device's Photos/Files picker (including iPhone HEIC when its browser can decode it) and existing images in the brand's private Asset Vault.

The existing signed-in, owner-initiated Studio -> ChatGPT -> Studio response flow remains intact.

## How image handoff works
1. The owner chooses files and/or existing Vault images in **Ember > Ask Ember**.
2. Studio previews and validates the selection (six files maximum; 12 MB per device image).
3. On **Prepare handoff**, each selected device image is uploaded to the existing private `brand-assets` storage bucket, with a brand-scoped Asset Vault record. A successfully uploaded image is reused on retry; no duplicate upload is required.
4. The handoff includes only the selected `reference_images` array with brand-scoped asset IDs, names and source, **not** raw image bytes, signed URLs or authentication credentials. The secured return-bridge function and reply IDs are unchanged.
5. On receiving this handoff, Ember uses the connected BSMS `get_asset_image` tool for **each** referenced asset so the actual image content can be reviewed.
6. Ember writes only the usual reply via `submit_ember_reply`. Images do not authorize publishing, saving content drafts, or editing other Studio records.

## Privacy and ownership
- Device uploads are retained in the brand's private Asset Vault; this is disclosed in the picker. Existing Vault images are not duplicated.
- Uploaded references have `approved_for_marketing: false` and are tagged as owner-provided.
- Asset storage paths follow Studio's existing `user_id/brand_id/unique_id/file` convention, with existing Storage RLS.
- The picker lists only images for the active brand; brand switches and New Request clear the attachment selection.
- The user can remove selected images before preparing. Removing them from the request does not delete uploaded files from Asset Vault.
- No separate image-generation API, automated publishing, additional OAuth permissions, or new database schema are required.

## Smoke tests completed
- JavaScript syntax validation of both scripts
- Correct script dependency order (app.js -> attachments -> studio-power-tools.js)
- Simulated image selection, preview, authenticated Storage upload and asset-row insertion
- Simulated selection from Asset Vault; both image references appear together
- Cleared selection on reset; upload did not set marketing approval
- Handoff includes reference IDs plus tool instructions to inspect actual image content

## Live manual acceptance test (after deploy)
1. In Stag & Stone, open **Ember > Ask Ember**, attach a JPG photo, and verify the thumbnail appears.
2. Add a second image from the brand's Asset Vault and type: "Use these images to create pre-opening social content."
3. Tap **Prepare handoff**; confirm the status is ready and (for the new file) the private asset appears in the Vault.
4. Tap **Share to ChatGPT** and send. Ember should retrieve and visually inspect **both** images and return the requested copy.
5. Back in Studio, tap **Check for reply**; the reply should appear as usual. Nothing is published.
6. Tap **New request**; images should be cleared, and the normal text-only Ask Ember flow should still work.

## Limits
- HEIC may require a browser that can decode it for client-side JPEG conversion. If the browser cannot decode the source, the user receives a specific error and may upload a JPEG copy.
- This approach sends image references through the authenticated connector, not image bytes through the system share sheet. ChatGPT sees the images when the referenced assets are fetched via the connected tool.
