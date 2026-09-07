/** Line icons for the bottom nav — stroke uses currentColor. */
type P = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconIdentify({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.6a1 1 0 0 1 .84-.4h5.32a1 1 0 0 1 .84.4L17.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

export function IconJournal({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 5.5c-1.6-1.2-3.7-1.8-6-1.8-.7 0-1 .4-1 1v11c0 .6.4 1 1 1 2.3 0 4.4.6 6 1.8" />
      <path d="M12 5.5c1.6-1.2 3.7-1.8 6-1.8.7 0 1 .4 1 1v11c0 .6-.4 1-1 1-2.3 0-4.4.6-6 1.8" />
      <path d="M12 5.5v14" />
    </svg>
  );
}

export function IconFriends({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M16 5.2A3 3 0 0 1 16 11" />
      <path d="M17 14.6c2.2.3 3.9 1.9 4.5 4.4" />
    </svg>
  );
}

export function IconMap({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M9 4 3.7 5.8a1 1 0 0 0-.7 1V19a1 1 0 0 0 1.3 1L9 18.4l6 1.9 5.3-1.8a1 1 0 0 0 .7-1V6a1 1 0 0 0-1.3-1L15 6.6z" />
      <path d="M9 4v14.4M15 6.6V20.3" />
    </svg>
  );
}

export function IconProfile({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 19.2c.9-3.4 3.6-5.2 7-5.2s6.1 1.8 7 5.2" />
    </svg>
  );
}
