"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconFriends,
  IconIdentify,
  IconJournal,
  IconMap,
  IconProfile,
} from "@/components/TabIcons";
import { useKeyboardOpen } from "@/lib/useKeyboardOpen";
import { useUnread } from "@/lib/useUnread";
import { useUserCode } from "@/lib/useUserCode";

const TABS = [
  {
    href: "/",
    label: "Identify",
    Icon: IconIdentify,
    match: (p: string) => p === "/",
  },
  {
    href: "/journal",
    label: "Journal",
    Icon: IconJournal,
    match: (p: string) =>
      p.startsWith("/journal") ||
      p.startsWith("/log") ||
      p.startsWith("/checklist"),
  },
  {
    href: "/friends",
    label: "Friends",
    Icon: IconFriends,
    match: (p: string) => p.startsWith("/friend") || p.startsWith("/chat"),
    badge: true,
  },
  {
    href: "/map",
    label: "Map",
    Icon: IconMap,
    match: (p: string) => p.startsWith("/map"),
  },
  {
    href: "/profile",
    label: "Profile",
    Icon: IconProfile,
    match: (p: string) => p.startsWith("/profile") || p.startsWith("/settings"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { code } = useUserCode();
  const unread = useUnread(code);
  const keyboardOpen = useKeyboardOpen();

  return (
    <nav
      hidden={keyboardOpen}
      className="shrink-0 border-t border-border bg-surface"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon, match, badge }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {badge && unread > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
