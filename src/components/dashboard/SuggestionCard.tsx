"use client";

/**
 * SuggestionCard — Displays a single AI-generated suggestion with actions.
 *
 * Visual design:
 *   - Left border colored by suggestion type for quick scanning
 *   - Type badge with matching color scheme
 *   - Truncated body text (2 lines max) to keep cards compact
 *   - Accept (green) and Dismiss (gray) action buttons
 *
 * Type color mapping:
 *   follow_up          → blue
 *   thank_you          → green
 *   check_in           → amber
 *   drop_email         → purple
 *   pre_meeting_brief  → indigo
 */

import { Suggestion } from "@/lib/types";

interface SuggestionCardProps {
  /** The suggestion to display */
  suggestion: Suggestion;
  /** Called when the user accepts (acts on) this suggestion */
  onAccept: (id: string) => void;
  /** Called when the user dismisses this suggestion */
  onDismiss: (id: string) => void;
}

/**
 * Returns border, badge background, and badge text color classes
 * based on the suggestion type. Each type has a distinct color
 * so users can visually scan suggestion lists by category.
 */
function getTypeColors(type: Suggestion["type"]): {
  border: string;
  badge: string;
  text: string;
} {
  switch (type) {
    case "follow_up":
      return { border: "border-blue-500", badge: "bg-blue-100", text: "text-blue-800" };
    case "thank_you":
      return { border: "border-green-500", badge: "bg-green-100", text: "text-green-800" };
    case "check_in":
      return { border: "border-amber-500", badge: "bg-amber-100", text: "text-amber-800" };
    case "drop_email":
      return { border: "border-purple-500", badge: "bg-purple-100", text: "text-purple-800" };
    case "pre_meeting_brief":
      return { border: "border-indigo-500", badge: "bg-indigo-100", text: "text-indigo-800" };
    default:
      return { border: "border-gray-500", badge: "bg-gray-100", text: "text-gray-800" };
  }
}

/** Formats the suggestion type string for display (e.g., "follow_up" → "Follow Up") */
function formatType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: SuggestionCardProps) {
  const colors = getTypeColors(suggestion.type);

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${colors.border} p-4`}>
      {/* Header: type badge and contact name */}
      <div className="flex items-center justify-between mb-2">
        {/* Type badge — color-coded pill */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge} ${colors.text}`}>
          {formatType(suggestion.type)}
        </span>

        {/* Contact name if available (from joined contact data) */}
        {suggestion.contact?.name && (
          <span className="text-xs text-gray-400 truncate ml-2">
            {suggestion.contact.name}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-gray-900 mb-1">
        {suggestion.title}
      </h4>

      {/* Body — truncated to 2 lines to keep cards compact */}
      <p className="text-xs text-gray-600 line-clamp-2 mb-3">
        {suggestion.body}
      </p>

      {/* Action buttons: Accept and Dismiss */}
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(suggestion.id)}
          className="text-xs px-3 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="text-xs px-3 py-1 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
