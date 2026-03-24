/**
 * Shared formatting utilities used across pages.
 */

/** Formats a date string as a human-readable relative time (e.g. "3d ago", "2w ago"). */
export function formatRelative(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Returns a Tailwind color class for a warmth score bar. */
export function warmthColor(score: number): string {
  if (score >= 70) return "bg-green-500/70";
  if (score >= 40) return "bg-yellow-500/70";
  return "bg-red-500/70";
}
