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
 * focused and the visual viewport has shrunk noticeably. Used to hide the
 * bottom nav so it doesn't float in the middle of the screen.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let focused = false;

    const sync = () => {
      const shrink = window.innerHeight - vv.height;
      setOpen(focused && shrink > 120);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        focused = true;
        sync();
      }
    };
    const onFocusOut = () => {
      focused = false;
      setOpen(false);
    };

    vv.addEventListener("resize", sync);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      vv.removeEventListener("resize", sync);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}
