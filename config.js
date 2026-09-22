/* =========================================================
   BLACK STAG MARKETING STUDIO
   config.js
   v2

   Browser-safe application configuration.

   V1 AI MODE:
   ChatGPT Manual

   Marketing Studio builds a complete AI brief.
   The user copies that brief into ChatGPT, then pastes
   the finished result back into Marketing Studio.

   IMPORTANT:
   Never place OpenAI API keys, Supabase service-role keys,
   social-media secrets, passwords, or other private
   credentials in this file.

   Future automatic AI requests will run through a secure
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
      "0.2.0",

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

     Current V1:
     manual-chatgpt

     Future:
     openai-api

     No private API key belongs here.
     ======================================================= */

  ai: {
    mode:
      "manual-chatgpt",

    providers: {

      manualChatGPT: {
        enabled:
          true,

        label:
          "ChatGPT — Manual"
      },

      openAI: {
        enabled:
          false,

        label:
          "OpenAI API — Automatic",

        endpoint:
          ""
      }

    }
  },


  /* =======================================================
     PUBLISHING

     Nothing publishes automatically in V1.

     Content must move through the approval workflow.
     ======================================================= */

  publishing: {
    enabled:
      false,

    requireApproval:
      true
  }

};