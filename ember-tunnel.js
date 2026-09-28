"use strict";

(function () {
  const state = {
    runs: [],
    brandId: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function currentBrand() {
    try {
      return typeof getActiveBrand === "function" ? getActiveBrand() : null;
    } catch {
      return null;
    }
  }

  function html(value) {
    if (typeof escapeHtml === "function") {
      return escapeHtml(String(value ?? ""));
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderRuns() {
    const host = byId("emberTunnelConversation");

    if (!host) {
      return;
    }

    if (!state.runs.length) {
      host.innerHTML =
        "<div class='empty-state'><h3>No Ember replies yet.</h3><p>Ask Ember something about the current brand and the reply will return here.</p></div>";
      return;
    }

    host.innerHTML =
      state.runs
        .map(run => {
          const status =
            run.status || "pending";

          let response =
            "Ember is thinking…";

          if (
            status === "answered" &&
            run.response_text
          ) {
            response =
              run.response_text;
          } else if (status === "failed") {
            response =
              run.error_text ||
              "The request failed before Ember could reply.";
          } else if (status === "cancelled") {
            response =
              "This request was cancelled.";
          }

          return (
            "<article class='ember-dialog-row' style='grid-template-columns:1fr'>" +
              "<div><span class='eyebrow'>" +
                html(status) +
              "</span><h3>" +
                html(run.request_text || "Ember request") +
              "</h3><p style='white-space:pre-wrap'>" +
                html(response) +
              "</p></div>" +
            "</article>"
          );
        })
        .join("");
  }

  function upsertRun(run) {
    if (!run?.id) {
      return;
    }

    state.runs = [
      run,
      ...state.runs.filter(
        item =>
          String(item.id) !==
          String(run.id)
      )
    ]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      )
      .slice(0, 6);

    renderRuns();
  }

  async function loadRuns() {
    const brand =
      currentBrand();

    if (
      !brand ||
      typeof supabaseClient === "undefined" ||
      !supabaseClient
    ) {
      return;
    }

    state.brandId =
      brand.id;

    const {
      data,
      error
    } =
      await supabaseClient
        .from("ember_agent_runs")
        .select("id,request_text,status,response_text,error_text,created_at,responded_at")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
        .limit(6);

    if (error) {
      throw error;
    }

    state.runs =
      data || [];

    renderRuns();
  }

  async function waitForReply(
    runId
  ) {
    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      await new Promise(
        resolve =>
          window.setTimeout(
            resolve,
            attempt === 0
              ? 1200
              : 1800
          )
      );

      const {
        data,
        error
      } =
        await supabaseClient
          .from("ember_agent_runs")
          .select("id,request_text,status,response_text,error_text,created_at,responded_at")
          .eq("id", runId)
          .single();

      if (error) {
        throw error;
      }

      upsertRun(data);

      if (
        [
          "answered",
          "failed",
          "cancelled"
        ].includes(data.status)
      ) {
        return;
      }
    }
  }

  async function submitRequest(
    event
  ) {
    event.preventDefault();

    const brand =
      currentBrand();

    const input =
      byId("emberTunnelInput");

    const button =
      byId("emberTunnelSend");

    const requestText =
      String(
        input?.value ||
        ""
      ).trim();

    if (
      !brand ||
      !requestText
    ) {
      return;
    }

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "Sending…";
    }

    try {
      const {
        data,
        error
      } =
        await supabaseClient
          .functions
          .invoke(
            "trigger-ember-agent",
            {
              body: {
                request_type:
                  "studio_chat",
                brand_id:
                  brand.id,
                request_text:
                  requestText,
                request_context: {
                  source:
                    "ember_daily_brief",
                  brand: {
                    id:
                      brand.id,
                    name:
                      brand.name ||
                      null
                  }
                }
              }
            }
          );

      if (error) {
        throw error;
      }

      if (!data?.run_id) {
        throw new Error(
          "Ember request was accepted without a run id."
        );
      }

      if (input) {
        input.value =
          "";
      }

      upsertRun({
        id:
          data.run_id,
        request_text:
          requestText,
        status:
          data.status ||
          "triggered",
        response_text:
          null,
        error_text:
          null,
        created_at:
          new Date().toISOString(),
        responded_at:
          null
      });

      waitForReply(
        data.run_id
      ).catch(error => {
        console.error(
          "Ember reply polling failed:",
          error
        );
      });

    } catch (error) {
      console.error(
        "Ember request failed:",
        error
      );

      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          error?.message ||
          "Unable to reach Ember.",
          "error",
          5000
        );
      }

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "Send to Ember";
      }
    }
  }

  function injectPanel() {
    const dialog =
      byId("emberBriefDialog");

    const body =
      dialog?.querySelector(
        ".ember-dialog-body"
      );

    if (
      !body ||
      byId("emberTunnelPanel")
    ) {
      return;
    }

    const section =
      document.createElement(
        "section"
      );

    section.id =
      "emberTunnelPanel";

    section.className =
      "ember-dialog-section";

    section.innerHTML =
      "<div class='section-heading-row'>" +
        "<div><span class='eyebrow'>Ask Ember</span><h3 style='margin:4px 0 0'>Live Workspace Agent</h3></div>" +
        "<button class='text-button' id='emberTunnelRefresh' type='button'>Refresh Replies</button>" +
      "</div>" +
      "<form id='emberTunnelForm' class='create-form' style='padding:0'>" +
        "<label class='field'><span>Message</span><textarea id='emberTunnelInput' rows='3' maxlength='20000' required placeholder='Tell Ember what you need from this brand…'></textarea></label>" +
        "<div class='form-actions'><span class='muted-copy'>Review-only tunnel. No publishing or consequential actions.</span><button class='primary-button' id='emberTunnelSend' type='submit'>Send to Ember</button></div>" +
      "</form>" +
      "<div id='emberTunnelConversation'></div>";

    const summary =
      body.querySelector(
        ".ember-brief-summary-grid"
      );

    if (summary) {
      summary.insertAdjacentElement(
        "afterend",
        section
      );
    } else {
      body.insertAdjacentElement(
        "afterbegin",
        section
      );
    }

    byId("emberTunnelForm")
      ?.addEventListener(
        "submit",
        submitRequest
      );

    byId("emberTunnelRefresh")
      ?.addEventListener(
        "click",
        () => {
          loadRuns()
            .catch(error => {
              console.error(
                "Unable to refresh Ember replies:",
                error
              );
            });
        }
      );

    loadRuns()
      .catch(error => {
        console.warn(
          "Unable to load Ember reply history:",
          error
        );
      });
  }

  const observer =
    new MutationObserver(
      () => {
        injectPanel();
      }
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  window.setTimeout(
    injectPanel,
    500
  );
})();