"use client";

/**
 * Timeline — Vertical timeline of interactions for a contact.
 *
 * Renders a chronological list of interactions with a vertical connector line
 * on the left side. Each interaction is displayed using the InteractionItem
 * component. The connector line visually groups related interactions.
 *
 * Layout:
 *   - A thin vertical line runs down the left side (via CSS pseudo-element)
 *   - Each InteractionItem is positioned to the right of the line
 *   - Empty state message shown when there are no interactions
 */

import { Interaction } from "@/lib/types";
import InteractionItem from "@/components/interactions/InteractionItem";

interface TimelineProps {
  /** Interactions to display, ordered chronologically (newest first) */
  interactions: Interaction[];
}

export default function Timeline({ interactions }: TimelineProps) {
  /* Empty state: no interactions to display */
  if (interactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">No interactions yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/*
       * Vertical connector line.
       * Positioned absolutely on the left side, running the full height
       * of the timeline. The line is offset to align with the center
       * of the interaction type icons.
       */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      {/* Interaction entries — each spaced along the vertical line */}
      <div className="space-y-4 pl-2">
        {interactions.map((interaction) => (
          <div key={interaction.id} className="relative">
            <InteractionItem interaction={interaction} />
          </div>
        ))}
      </div>
    </div>
  );
}
