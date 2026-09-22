/* =========================================================
   BLACK STAG MARKETING STUDIO
   config.js

   Browser-safe application configuration.

   IMPORTANT:
   - The Supabase Project URL is safe for the browser.
   - The Supabase Publishable Key is safe for the browser.
   - NEVER place a Supabase Secret Key here.
   - NEVER place a service_role key here.
   - NEVER place an OpenAI API key here.
   ========================================================= */

window.BLACK_STAG_CONFIG = {
  app: {
    name: "Black Stag Marketing Studio",
    version: "0.3.0",
    environment: "development"
  },

  /* =======================================================
     SUPABASE
     ======================================================= */

  supabase: {
    /*
      Paste the Project URL from:
      Supabase → Settings → Data API

      Example format:
      https://xxxxxxxxxxxxxxxxxxxx.supabase.co
    */
    url: "https://lpjpuedylongafgqbwjh.supabase.co",

    /*
      Paste ONLY the Publishable key from:
      Supabase → Settings → API Keys → Publishable key

      It should begin with:
      sb_publishable_

      DO NOT use anything from the Secret keys section.
    */
    publishableKey: "sb_publishable_Qydee2Ugq7Tm9qCgBgvGSA_8yDHusJy"
  },

  /* =======================================================
     AI
     ======================================================= */

  ai: {
    /*
      V1 uses ChatGPT manually.

      Marketing Studio builds the complete Brand Brain prompt.
      You copy it into ChatGPT, then paste the generated result
      back into Marketing Studio.

      This keeps V1 free of separate AI API charges.
    */
    mode: "manual-chatgpt",

    providers: {
      manualChatGPT: {
        enabled: true,
        label: "ChatGPT — Manual"
      },

      /*
        Reserved for a future automatic AI connection.

        Any OpenAI API request will eventually go through a
        secure server-side Supabase Edge Function.

        An OpenAI secret key must NEVER be stored here.
      */
      openAI: {
        enabled: false,
        label: "OpenAI API — Automatic",
        endpoint: ""
      }
    }
  },

  /* =======================================================
     PUBLISHING
     ======================================================= */

  publishing: {
    enabled: false,

    /*
      Content must be explicitly approved before it can
      eventually move into scheduling/publishing.
    */
    requireApproval: true
  }
};
