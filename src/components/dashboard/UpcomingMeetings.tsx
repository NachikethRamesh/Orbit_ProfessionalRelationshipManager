"use client";

/**
 * UpcomingMeetings — Dashboard panel listing upcoming calendar meetings.
 *
 * Each meeting shows:
 *   - Subject (meeting title)
 *   - Contact name (if available from joined data)
 *   - Formatted date and time
 *   - "View Brief" link to the meeting brief / contact detail page
 *
 * When there are no upcoming meetings, displays a friendly empty state.
 */

import Link from "next/link";
import { Interaction, Contact } from "@/lib/types";

interface UpcomingMeetingsProps {
  /** Meeting interactions, optionally enriched with a contact object */
  meetings: (Interaction & { contact?: Contact })[];
}

/**
 * Formats an ISO date string into a human-readable date and time.
 * Example: "2026-03-21T14:00:00Z" → "Mar 21, 2:00 PM"
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function UpcomingMeetings({ meetings }: UpcomingMeetingsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* Section heading */}
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Upcoming Meetings
      </h3>

      {/* Empty state */}
      {meetings.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          No upcoming meetings
        </p>
      ) : (
        /* Meeting list */
        <ul className="space-y-3">
          {meetings.map((meeting) => (
            <li
              key={meeting.id}
              className="flex items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                {/* Meeting subject / title */}
                <p className="text-sm font-medium text-gray-800 truncate">
                  {meeting.subject}
                </p>

                {/* Contact name (if available from join) */}
                {meeting.contact?.name && (
                  <p className="text-xs text-gray-500 truncate">
                    with {meeting.contact.name}
                  </p>
                )}

                {/* Formatted date and time */}
                <p className="text-xs text-gray-400">
                  {formatDateTime(meeting.occurred_at)}
                </p>
              </div>

              {/* "View Brief" link navigates to the contact detail page */}
              <Link
                href={`/contacts/${meeting.contact_id}`}
                className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
              >
                View Brief
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
