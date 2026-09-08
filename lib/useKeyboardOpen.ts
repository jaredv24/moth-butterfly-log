"use client";

import { useEffect, useState } from "react";

function isEditable(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

/**
 * True while the on-screen keyboard is (very likely) open.
 *
 * Detection: capture the visual-viewport height the moment a text field is
 * focused (before the keyboard animates in), then treat a later shrink of
 * >100px as the keyboard. This works in both a browser tab and an installed
 * PWA, where `window.innerHeight` behaves inconsistently.
 *
 * Side effects on <html>, applied synchronously so there's no render gap:
 *  - `--app-h` = visible viewport height (the fixed shell is
 *    `h-[var(--app-h,100dvh)]`, so it collapses to the area above the keyboard)
 *  - `.kb-open` class (CSS hides the bottom nav)
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let focused = false;
    let baseline = 0;

    const setKeyboard = (on: boolean) => {
      setOpen(on);
      if (on) {
        root.style.setProperty("--app-h", `${Math.round(vv.height)}px`);
        root.classList.add("kb-open");
      } else {
        root.style.removeProperty("--app-h");
        root.classList.remove("kb-open");
      }
    };

    const sync = () => {
      // baseline tracks the tallest viewport seen this focus session, so
      // switching between fields (keyboard already up) still counts as open
      if (focused && vv.height > baseline) baseline = vv.height;
      const on = focused && baseline > 0 && vv.height < baseline - 100;
      setKeyboard(on);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        focused = true;
        if (vv.height > baseline) baseline = vv.height;
        sync();
      }
    };
    const onFocusOut = () => {
      focused = false;
      baseline = 0;
      setKeyboard(false);
    };

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      root.style.removeProperty("--app-h");
      root.classList.remove("kb-open");
    };
  }, []);

  return open;
}
