"use client";

/**
 * ContactCard — Summary card for a single contact.
 *
 * Displays the contact's name, email, company, warmth bar, and tags.
 * The entire card is wrapped in a link to the contact detail page.
 * Designed for use inside ContactList's responsive grid.
 */

import Link from "next/link";
import { Contact } from "@/lib/types";
import WarmthBar from "@/components/contacts/WarmthBar";
import TagBadge from "@/components/contacts/TagBadge";

interface ContactCardProps {
  /** The contact to display */
  contact: Contact;
}

export default function ContactCard({ contact }: ContactCardProps) {
  return (
    /* Card links to the contact detail page */
    <Link href={`/contacts/${contact.id}`} className="block">
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
        {/* Top row: name and company */}
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {contact.name}
          </h3>
          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
          {/* Show company and title if available */}
          {contact.company && (
            <p className="text-xs text-gray-400 truncate">
              {contact.title ? `${contact.title} at ` : ""}
              {contact.company}
            </p>
          )}
        </div>

        {/* Warmth score bar — shows relationship health at a glance */}
        <div className="mb-2">
          <WarmthBar score={contact.warmth_score} />
        </div>

        {/* Tags row — renders a pill badge for each tag */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
