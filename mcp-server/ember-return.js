/**
 * Respond to a single owner-initiated Ember handoff with the caller's OAuth
 * session. No return capability, admin key, or service-role credentials.
 * Supabase RLS applies to every read and write.
 */
export async function submitOAuthEmberReply({
  supabase,
  authenticatedUser,
  requestId,
  brandId,
  responseText,
  now = () => new Date().toISOString()
}) {
  const ownerId = authenticatedUser?.id;
  if (!ownerId) {
    throw new Error("A signed-in Studio user is required.");
  }

  const reply = typeof responseText === "string" ? responseText.trim() : "";
  if (!reply || reply.length > 50000) {
    throw new Error("Reply must contain between 1 and 50000 characters.");
  }

  // The existing OAuth bearer is used for all queries. Brand RLS protects this read.
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    throw new Error("Unable to verify access to the Studio brand.");
  }
  if (!brand) {
    throw new Error("Studio brand is unavailable to this account.");
  }

  // Require both the originating brand and the exact original run owner.
  const { data: run, error: lookupError } = await supabase
    .from("ember_agent_runs")
    .select("id,owner_id,brand_id,request_type,status,response_text,authorization_context")
    .eq("id", requestId)
    .eq("brand_id", brandId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (lookupError) {
    throw new Error("Unable to verify the Ember handoff request.");
  }
  if (!run || run.owner_id !== ownerId || run.brand_id !== brandId) {
    throw new Error("No matching Ember handoff for this user and brand.");
  }

  const authorization = run.authorization_context;
  if (
    run.request_type !== "manual_handoff" ||
    authorization?.source !== "black_stag_marketing_studio" ||
    authorization?.mode !== "user_initiated_manual_handoff" ||
    authorization?.consequential_write_authorized !== false
  ) {
    throw new Error("This request is not an eligible Studio handoff.");
  }

  if (run.status !== "pending" || run.response_text !== null) {
    throw new Error("This Studio handoff is no longer awaiting a reply.");
  }

  // Conditional update prevents overwriting a cancelled, answered or raced run.
  const { data: saved, error: saveError } = await supabase
    .from("ember_agent_runs")
    .update({
      status: "answered",
      response_text: reply,
      responded_at: now(),
      error_text: null
    })
    .eq("id", requestId)
    .eq("brand_id", brandId)
    .eq("owner_id", ownerId)
    .eq("request_type", "manual_handoff")
    .eq("status", "pending")
    .is("response_text", null)
    .select("id,brand_id,status,responded_at")
    .maybeSingle();

  if (saveError) {
    throw new Error("Unable to store the Ember reply.");
  }
  if (!saved || saved.status !== "answered") {
    throw new Error("Reply was not stored; the request may have changed.");
  }

  return {
    saved: true,
    request_id: saved.id,
    brand_id: saved.brand_id,
    status: saved.status,
    responded_at: saved.responded_at
  };
}
