import { getDb } from "@/lib/db";
import { contacts, interactions, suggestions, reminders } from "@/lib/db/schema";
import { eq, and, lt, lte, gte, desc, asc, count, sql } from "drizzle-orm";
import { DashboardData } from "@/lib/types";

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const db = getDb();

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Query 1: Total contact count
  const contactCountResult = db.select({ count: count() }).from(contacts)
    .where(eq(contacts.user_id, userId)).get();

  // Query 2: Recent interactions with contact join
  const recentInteractionsRows = db.select({
    id: interactions.id,
    user_id: interactions.user_id,
    contact_id: interactions.contact_id,
    type: interactions.type,
    source_id: interactions.source_id,
    subject: interactions.subject,
    snippet: interactions.snippet,
    body_text: interactions.body_text,
    ai_summary: interactions.ai_summary,
    occurred_at: interactions.occurred_at,
    created_at: interactions.created_at,
    contact_name: contacts.name,
    contact_email: contacts.email,
    contact_id_ref: contacts.id,
  })
    .from(interactions)
    .leftJoin(contacts, eq(interactions.contact_id, contacts.id))
    .where(eq(interactions.user_id, userId))
    .orderBy(desc(interactions.occurred_at))
    .limit(5)
    .all();

  const recentInteractions = recentInteractionsRows.map((r) => ({
    ...r,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, name: r.contact_name, email: r.contact_email } : undefined,
  }));

  // Query 3: Pending suggestions with contact join
  const pendingSuggestionsRows = db.select({
    id: suggestions.id,
    user_id: suggestions.user_id,
    contact_id: suggestions.contact_id,
    type: suggestions.type,
    title: suggestions.title,
    body: suggestions.body,
    priority: suggestions.priority,
    status: suggestions.status,
    created_at: suggestions.created_at,
    contact_name: contacts.name,
    contact_email: contacts.email,
    contact_id_ref: contacts.id,
  })
    .from(suggestions)
    .leftJoin(contacts, eq(suggestions.contact_id, contacts.id))
    .where(and(eq(suggestions.user_id, userId), eq(suggestions.status, "pending")))
    .orderBy(desc(suggestions.priority))
    .limit(10)
    .all();

  const pendingSuggestions = pendingSuggestionsRows.map((r) => ({
    ...r,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, name: r.contact_name, email: r.contact_email } : undefined,
  }));

  // Query 4: Upcoming reminders with contact join
  const upcomingRemindersRows = db.select({
    id: reminders.id,
    user_id: reminders.user_id,
    contact_id: reminders.contact_id,
    suggestion_id: reminders.suggestion_id,
    title: reminders.title,
    remind_at: reminders.remind_at,
    status: reminders.status,
    created_at: reminders.created_at,
    contact_name: contacts.name,
    contact_email: contacts.email,
    contact_id_ref: contacts.id,
  })
    .from(reminders)
    .leftJoin(contacts, eq(reminders.contact_id, contacts.id))
    .where(and(
      eq(reminders.user_id, userId),
      eq(reminders.status, "pending"),
      lte(reminders.remind_at, sevenDaysFromNow.toISOString()),
    ))
    .orderBy(asc(reminders.remind_at))
    .all();

  const upcomingReminders = upcomingRemindersRows.map((r) => ({
    ...r,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, name: r.contact_name, email: r.contact_email } : undefined,
  }));

  // Query 5: Decaying contacts
  const decayingContacts = db.select().from(contacts)
    .where(and(eq(contacts.user_id, userId), lt(contacts.warmth_score, 30)))
    .orderBy(asc(contacts.warmth_score))
    .limit(10)
    .all();

  // Query 6: Upcoming meetings
  const upcomingMeetingsRows = db.select({
    id: interactions.id,
    user_id: interactions.user_id,
    contact_id: interactions.contact_id,
    type: interactions.type,
    source_id: interactions.source_id,
    subject: interactions.subject,
    snippet: interactions.snippet,
    body_text: interactions.body_text,
    ai_summary: interactions.ai_summary,
    occurred_at: interactions.occurred_at,
    created_at: interactions.created_at,
    contact_name: contacts.name,
    contact_email: contacts.email,
    contact_id_ref: contacts.id,
  })
    .from(interactions)
    .leftJoin(contacts, eq(interactions.contact_id, contacts.id))
    .where(and(
      eq(interactions.user_id, userId),
      eq(interactions.type, "meeting"),
      gte(interactions.occurred_at, now.toISOString()),
      lte(interactions.occurred_at, fortyEightHoursFromNow.toISOString()),
    ))
    .orderBy(asc(interactions.occurred_at))
    .all();

  const upcomingMeetings = upcomingMeetingsRows.map((r) => ({
    ...r,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, name: r.contact_name, email: r.contact_email } : undefined,
  }));

  return {
    totalContacts: contactCountResult?.count ?? 0,
    recentInteractions: recentInteractions as any[],
    pendingSuggestions: pendingSuggestions as any[],
    upcomingReminders: upcomingReminders as any[],
    decayingContacts: decayingContacts as any[],
    upcomingMeetings: upcomingMeetings as any[],
  };
}
