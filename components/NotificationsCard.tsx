"use client";

import { usePush } from "@/lib/usePush";

/** Web Push opt-in for chat messages. */
export function NotificationsCard({ code }: { code: string | null }) {
  const { state, enable, disable } = usePush(code);

  if (state === "unsupported") return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">
        Message notifications{" "}
        {state === "on" && <span className="text-accent">· on</span>}
      </h2>

      {state === "needs-install" ? (
        <p className="text-xs text-muted">
          On iPhone, add this app to your Home Screen first (Share → Add to Home
          Screen), then open it from there to turn on notifications.
        </p>
      ) : state === "denied" ? (
        <p className="text-xs text-muted">
          Notifications are blocked for this app in your device settings. Enable
          them there, then come back.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            Get a notification and an app-icon badge when a friend messages you,
            even when the app is closed. Set per device.
          </p>
          {state === "on" ? (
            <button
              onClick={disable}
              disabled={state !== "on"}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Turn off on this device
            </button>
          ) : (
            <button
              onClick={enable}
              disabled={state === "busy" || !code}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {state === "busy" ? "…" : "Turn on notifications"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
