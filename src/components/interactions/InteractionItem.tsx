"use client";

/**
 * InteractionItem — A single entry in the interaction timeline.
 *
 * Displays:
 *   - Type-specific icon with color coding:
 *       email_sent     → Mail icon (blue)
 *       email_received → MailOpen icon (green)
 *       meeting        → Calendar icon (purple)
 *   - Subject line
 *   - Formatted date
 *   - Snippet or AI summary (AI summaries shown in italic to distinguish them)
 */

import { Mail, MailOpen, Calendar } from "lucide-react";
import { Interaction } from "@/lib/types";

interface InteractionItemProps {
  /** The interaction record to render */
  interaction: Interaction;
}

/**
 * Returns the appropriate icon component and color class for an interaction type.
 *
 * Icon mapping rationale:
 *   - Mail (closed envelope) for sent emails — user initiated
 *   - MailOpen (open envelope) for received emails — user received
 *   - Calendar for meetings — scheduled events
 */
function getTypeIcon(type: Interaction["type"]) {
  switch (type) {
    case "email_sent":
      return { Icon: Mail, color: "text-blue-500", bg: "bg-blue-50" };
    case "email_received":
      return { Icon: MailOpen, color: "text-green-500", bg: "bg-green-50" };
    case "meeting":
      return { Icon: Calendar, color: "text-purple-500", bg: "bg-purple-50" };
    default:
      return { Icon: Mail, color: "text-gray-500", bg: "bg-gray-50" };
  }
}

/** Formats an ISO date string for display (e.g., "Mar 21, 2026") */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InteractionItem({ interaction }: InteractionItemProps) {
  const { Icon, color, bg } = getTypeIcon(interaction.type);

  return (
    <div className="flex gap-3">
      {/* Type icon with colored background */}
      <div className={`flex-shrink-0 p-2 rounded-full ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Subject line */}
        <p className="text-sm font-medium text-gray-900 truncate">
          {interaction.subject}
        </p>

        {/* Date */}
        <p className="text-xs text-gray-400 mb-1">
          {formatDate(interaction.occurred_at)}
        </p>

        {/*
         * Content: prefer AI summary over raw snippet.
         * AI summaries are rendered in italic to visually distinguish
         * machine-generated text from original email content.
         */}
        {interaction.ai_summary ? (
          <p className="text-xs text-gray-600 italic line-clamp-2">
            {interaction.ai_summary}
          </p>
        ) : interaction.snippet ? (
          <p className="text-xs text-gray-600 line-clamp-2">
            {interaction.snippet}
          </p>
        ) : null}
      </div>
    </div>
  );
}
