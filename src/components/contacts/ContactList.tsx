"use client";

/**
 * ContactList — Responsive grid of ContactCards with an empty state.
 *
 * Layout:
 *   - 1 column on mobile
 *   - 2 columns on medium screens (md)
 *   - 3 columns on large screens (lg)
 *
 * When the contacts array is empty, a friendly message is shown instead.
 */

import { Contact } from "@/lib/types";
import ContactCard from "@/components/contacts/ContactCard";

interface ContactListProps {
  /** Array of contacts to display in the grid */
  contacts: Contact[];
}

export default function ContactList({ contacts }: ContactListProps) {
  /* Empty state: shown when there are no contacts to display */
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No contacts found</p>
      </div>
    );
  }

  return (
    /* Responsive grid: 1 col → 2 cols → 3 cols as screen widens */
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </div>
  );
}
