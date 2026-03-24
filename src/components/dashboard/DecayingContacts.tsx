"use client";

/**
 * DecayingContacts — "Cooling Off" panel showing contacts whose warmth is dropping.
 *
 * Displayed on the dashboard to alert the user about relationships that need
 * attention. Each entry shows the contact name linked to their detail page
 * and a WarmthBar showing the current score.
 *
 * When all relationships are healthy (empty list), shows a reassuring message.
 */

import Link from "next/link";
import { Contact } from "@/lib/types";
import WarmthBar from "@/components/contacts/WarmthBar";

interface DecayingContactsProps {
  /** Contacts with declining warmth scores, sorted lowest-first */
  contacts: Contact[];
}

export default function DecayingContacts({ contacts }: DecayingContactsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* Section heading */}
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Cooling Off</h3>

      {/* Empty state: all relationships are healthy */}
      {contacts.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          All relationships are warm!
        </p>
      ) : (
        /* List of decaying contacts with warmth bars */
        <ul className="space-y-3">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/contacts/${contact.id}`}
                className="block hover:bg-gray-50 rounded-md p-2 -m-2 transition-colors"
              >
                {/* Contact name */}
                <p className="text-sm font-medium text-gray-800 truncate mb-1">
                  {contact.name}
                </p>
                {/* Warmth bar showing current score */}
                <WarmthBar score={contact.warmth_score} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
