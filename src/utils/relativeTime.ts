export function formatRelativeTime(value: string | undefined, now = Date.now()) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) return "Posted recently";

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (elapsedSeconds < 60) return "Posted just now";

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `Posted ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Posted ${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Posted ${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Posted ${weeks} wk${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `Posted ${months} mo${months === 1 ? "" : "s"} ago`;
}
