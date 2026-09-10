/**
 * iNaturalist photo URLs end in a size segment — square (75px), small (240),
 * medium (500), large (1024), original. Swap it to get a bigger version, e.g.
 * for a full-screen viewer.
 */
export function inatPhoto(
  url: string | null | undefined,
  size: "square" | "small" | "medium" | "large" | "original" = "large",
): string | null {
  if (!url) return null;
  return url.replace(
    /\/(square|small|medium|large|original)\.([a-zA-Z]+)(\?.*)?$/,
    `/${size}.$2$3`,
  );
}
