/* =========================================================
   BLACK STAG MARKETING STUDIO
   config.js
   v1

   Browser-safe application configuration.

   IMPORTANT:
   Never place OpenAI API keys, Supabase service-role keys,
   social-media secrets, or other private credentials here.

   AI requests will eventually run through a secure
   server-side / Supabase Edge Function layer.
   ========================================================= */

"use strict";


window.BLACK_STAG_CONFIG = {

  /* =======================================================
     APP
     ======================================================= */

  app: {
    name:
      "Black Stag Marketing Studio",

    version:
      "0.1.0",

    environment:
      "development"
  },


  /* =======================================================
     SUPABASE

     These remain blank until the Supabase project
     is created.

     Browser-safe values only:
     - Project URL
     - Anon / publishable key

     NEVER:
     - service_role key
     ======================================================= */

  supabase: {
    url:
      "",

    anonKey:
      ""
  },


  /* =======================================================
     AI

     No API secret belongs here.

     Later, the app will call our secure AI endpoint.
     ======================================================= */

  ai: {
    enabled:
      false,

    endpoint:
      ""
  },


  /* =======================================================
     PUBLISHING

     Direct publishing is disabled until official
     platform connections are configured.
     ======================================================= */

  publishing: {
    enabled:
      false
  }

};