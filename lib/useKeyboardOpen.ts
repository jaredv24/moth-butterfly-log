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
 * True while the on-screen keyboard is (very likely) open: a text field is
 * focused and the visual viewport has shrunk noticeably.
 *
 * Side effect: while the keyboard is open, sets `--app-h` on <html> to the
 * visible viewport height so the fixed shell (and the chat composer pinned to
 * its bottom) collapse to the area above the keyboard instead of hiding behind
 * it. The value is cleared when the keyboard closes, falling back to 100dvh.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let focused = false;

    const sync = () => {
      const shrink = window.innerHeight - vv.height;
      const kb = focused && shrink > 120;
      setOpen(kb);
      if (kb) root.style.setProperty("--app-h", `${Math.round(vv.height)}px`);
      else root.style.removeProperty("--app-h");
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        focused = true;
        sync();
      }
    };
    const onFocusOut = () => {
      focused = false;
      sync();
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
    };
  }, []);

  return open;
}
