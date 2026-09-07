"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Identify", icon: "📸", match: (p: string) => p === "/" },
  {
    href: "/journal",
    label: "Journal",
    icon: "📖",
    match: (p: string) =>
      p.startsWith("/journal") ||
      p.startsWith("/log") ||
      p.startsWith("/checklist"),
  },
  {
    href: "/friends",
    label: "Friends",
    icon: "👥",
    match: (p: string) => p.startsWith("/friend"),
  },
  { href: "/map", label: "Map", icon: "🗺️", match: (p: string) => p.startsWith("/map") },
  {
    href: "/profile",
    label: "Profile",
    icon: "👤",
    match: (p: string) => p.startsWith("/profile") || p.startsWith("/settings"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="shrink-0 border-t border-border bg-surface">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
