"use client";

/**
 * SuggestionList — Renders a list of AI-generated suggestion cards.
 *
 * Maps each suggestion to a SuggestionCard component, passing through
 * the accept and dismiss callbacks. Shows an empty state when there
 * are no suggestions to display.
 *
 * Used on both the dashboard (for pending suggestions) and the
 * dedicated suggestions page (for all suggestions).
 */

import { Suggestion } from "@/lib/types";
import SuggestionCard from "@/components/dashboard/SuggestionCard";

interface SuggestionListProps {
  /** Array of suggestions to render */
  suggestions: Suggestion[];
  /** Called when the user accepts a suggestion, with the suggestion ID */
  onAccept: (id: string) => void;
  /** Called when the user dismisses a suggestion, with the suggestion ID */
  onDismiss: (id: string) => void;
}

export default function SuggestionList({
  suggestions,
  onAccept,
  onDismiss,
}: SuggestionListProps) {
  /* Empty state: no suggestions available */
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">No suggestions right now</p>
      </div>
    );
  }

  return (
    /* Vertical stack of suggestion cards with consistent spacing */
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={onAccept}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
