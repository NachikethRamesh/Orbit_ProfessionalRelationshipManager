"use client";

/**
 * WarmthBar — Visual indicator of a contact's relationship warmth score.
 *
 * Displays a horizontal progress bar colored by warmth level:
 *   - 0-25  (Cold)       → Blue      (#3B82F6) — relationship needs attention
 *   - 25-50 (Cool)       → Light Blue (#60A5FA) — some recent activity
 *   - 50-75 (Warm)       → Amber     (#F59E0B) — healthy relationship
 *   - 75-100 (Hot)       → Red       (#EF4444) — very active relationship
 *
 * The numeric score is displayed to the right of the bar.
 */

interface WarmthBarProps {
  /** Warmth score from 0 (cold) to 100 (hot) */
  score: number;
}

/**
 * Returns a Tailwind background-color class based on the warmth score range.
 *
 * Color logic:
 *   score <= 25  → blue-500   (cold: relationship is fading)
 *   score <= 50  → blue-400   (cool: moderate activity)
 *   score <= 75  → amber-500  (warm: healthy engagement)
 *   score > 75   → red-500    (hot: very frequent interaction)
 */
function getWarmthColor(score: number): string {
  if (score <= 25) return "bg-blue-500";
  if (score <= 50) return "bg-blue-400";
  if (score <= 75) return "bg-amber-500";
  return "bg-red-500";
}

export default function WarmthBar({ score }: WarmthBarProps) {
  /* Clamp the score between 0 and 100 for safety */
  const clampedScore = Math.max(0, Math.min(100, score));
  const colorClass = getWarmthColor(clampedScore);

  return (
    <div className="flex items-center gap-2">
      {/* Outer container: gray track for the bar */}
      <div className="flex-1 h-2 rounded-full bg-gray-200">
        {/* Inner fill: width and color determined by score */}
        <div
          className={`h-2 rounded-full ${colorClass} transition-all duration-300`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>

      {/* Numeric score label */}
      <span className="text-xs font-medium text-gray-600 w-8 text-right">
        {clampedScore}
      </span>
    </div>
  );
}
