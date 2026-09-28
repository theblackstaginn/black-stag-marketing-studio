"use strict";

self.addEventListener(
  "push",
  event => {
    let payload = {
      title:
        "Black Stag Marketing Studio",

      body:
        "You have something scheduled tomorrow.",

      tag:
        "black-stag-reminder",

      data: {
        url:
          "./?view=calendar"
      }
    };

    try {
      if (
        event.data
      ) {
        payload = {
          ...payload,
          ...event.data.json()
        };
      }
    } catch (error) {
      try {
        payload.body =
          event.data?.text?.() ||
          payload.body;
      } catch {}
    }

    event.waitUntil(
      self.registration
        .showNotification(
          payload.title,
          {
            body:
              payload.body,

            tag:
              payload.tag ||
              "black-stag-reminder",

            data:
              payload.data ||
              {
                url:
                  "./?view=calendar"
              },

            renotify:
              false
          }
        )
    );
  }
);


self.addEventListener(
  "notificationclick",
  event => {
    event.notification
      .close();

    const targetUrl =
      new URL(
        event.notification
          .data?.url ||
        "./?view=calendar",
        self.registration
          .scope
      ).href;

    event.waitUntil(
      self.clients
        .matchAll(
          {
            type:
              "window",

            includeUncontrolled:
              true
          }
        )
        .then(
          windowClients => {
            for (
              const client of
              windowClients
            ) {
              if (
                "navigate" in
                client
              ) {
                client.navigate(
                  targetUrl
                );
              }

              if (
                "focus" in
                client
              ) {
                return client
                  .focus();
              }
            }

            if (
              self.clients
                .openWindow
            ) {
              return self.clients
                .openWindow(
                  targetUrl
                );
            }

            return undefined;
          }
        )
    );
  }
);
