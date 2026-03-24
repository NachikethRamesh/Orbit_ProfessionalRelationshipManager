/**
 * Shared TypeScript Interfaces
 *
 * These types are used across the entire app (client and server).
 * They mirror the Supabase database schema and define the shape
 * of data flowing through the application.
 */

// ─── Core Entities ───────────────────────────────────────────

/** Authenticated user profile (maps to Supabase auth.users + profiles table) */
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

/**
 * A person in the user's network.
 * warmth_score is 0-100 and decays over time without interaction.
 * exa_data holds enrichment info fetched from the Exa API.
 */
export interface Contact {
  id: string;
  user_id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  linkedin_url: string;
  twitter_url: string;
  phone: string;
  location: string;
  other_emails: string[];
  starred: boolean;
  warmth_score: number;
  exa_data: Record<string, unknown> | null;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * A recorded communication or meeting with a contact.
 * type distinguishes the kind of interaction; source_id links
 * back to the original Gmail message ID or Calendar event ID.
 */
export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  type: "email_sent" | "email_received" | "meeting";
  source_id: string;
  subject: string;
  snippet: string;
  body_text: string;
  ai_summary: string;
  occurred_at: string;
  created_at: string;
}

/**
 * An AI-generated suggestion for the user to act on.
 * Linked to a specific contact; includes a human-readable title
 * and body with context on why the action is recommended.
 */
export interface Suggestion {
  id: string;
  user_id: string;
  contact_id: string;
  /** Populated when fetched with a join — the related contact record */
  contact?: Contact;
  type:
    | "follow_up"
    | "thank_you"
    | "check_in"
    | "drop_email"
    | "pre_meeting_brief";
  title: string;
  body: string;
  priority: number;
  status: "pending" | "accepted" | "dismissed" | "snoozed";
  created_at: string;
}

/**
 * A time-based reminder for the user, optionally linked to a suggestion.
 * remind_at is the ISO timestamp when the user should be notified.
 */
export interface Reminder {
  id: string;
  user_id: string;
  contact_id: string;
  /** Populated when fetched with a join — the related contact record */
  contact?: Contact;
  suggestion_id: string;
  title: string;
  remind_at: string;
  status: "pending" | "completed" | "dismissed";
  created_at: string;
}

// ─── Composite / View Types ─────────────────────────────────

/** Aggregated data for the main dashboard view */
export interface DashboardData {
  /** Total number of contacts the user has */
  totalContacts: number;
  /** Most recent interactions across all contacts */
  recentInteractions: Interaction[];
  /** AI suggestions waiting for user action */
  pendingSuggestions: Suggestion[];
  /** Reminders coming up soon */
  upcomingReminders: Reminder[];
  /** Contacts whose warmth score is dropping (need attention) */
  decayingContacts: Contact[];
  /** Calendar meetings happening in the near future */
  upcomingMeetings: Interaction[];
}

/** Filters applied to the contacts list page */
export interface ContactFilters {
  /** Free-text search across name, email, company */
  search?: string;
  /** Filter to contacts that have this tag */
  tag?: string;
  /** Show only starred/favorite contacts */
  starred?: boolean;
  /** Column to sort by (e.g., "name", "warmth_score", "updated_at") */
  sort_by?: string;
  /** Sort direction */
  sort_order?: "asc" | "desc";
}
