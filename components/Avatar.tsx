/** Round avatar with a neutral fallback. */
export function Avatar({
  url,
  size = 40,
}: {
  url?: string | null;
  size?: number;
}) {
  const px = `${size}px`;
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        style={{ width: px, height: px }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px }}
      className="grid shrink-0 place-items-center rounded-full bg-border text-sm text-muted"
    >
      👤
    </div>
  );
}
