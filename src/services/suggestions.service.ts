import { getDb } from "@/lib/db";
import { suggestions, reminders, contacts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Suggestion } from "@/lib/types";
import crypto from "crypto";

export async function listSuggestions(
  userId: string,
  status?: string,
  contactId?: string
): Promise<Suggestion[]> {
  const db = getDb();

  const rows = db.select({
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
    .where(
      and(
        eq(suggestions.user_id, userId),
        ...(status ? [eq(suggestions.status, status)] : []),
        ...(contactId ? [eq(suggestions.contact_id, contactId)] : []),
      )
    )
    .orderBy(desc(suggestions.priority))
    .all();

  return rows.map((r) => ({
    ...r,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, name: r.contact_name, email: r.contact_email } : undefined,
  })) as any[];
}

export async function updateSuggestion(
  userId: string,
  id: string,
  status: string,
  remindAt?: string
): Promise<void> {
  const db = getDb();

  db.update(suggestions)
    .set({ status })
    .where(and(eq(suggestions.id, id), eq(suggestions.user_id, userId)))
    .run();

  const suggestion = db.select().from(suggestions).where(eq(suggestions.id, id)).get();

  if (status === "snoozed" && remindAt && suggestion) {
    db.insert(reminders).values({
      id: crypto.randomUUID(),
      user_id: userId,
      contact_id: suggestion.contact_id,
      suggestion_id: id,
      title: suggestion.title,
      remind_at: remindAt,
      status: "pending",
    }).run();
  }
}

export async function createSuggestion(
  data: Omit<Suggestion, "id" | "created_at">
): Promise<Suggestion | null> {
  const db = getDb();

  // Dedup check
  const existing = db.select({ id: suggestions.id }).from(suggestions)
    .where(and(
      eq(suggestions.user_id, data.user_id),
      eq(suggestions.contact_id, data.contact_id),
      eq(suggestions.type, data.type),
      eq(suggestions.status, "pending"),
    ))
    .get();

  if (existing) return null;

  const id = crypto.randomUUID();
  db.insert(suggestions).values({ id, ...data }).run();

  const result = db.select().from(suggestions).where(eq(suggestions.id, id)).get();
  return result as unknown as Suggestion;
}

export async function getPendingSuggestionTypes(
  userId: string,
  contactId: string
): Promise<string[]> {
  const db = getDb();

  const rows = db.select({ type: suggestions.type }).from(suggestions)
    .where(and(
      eq(suggestions.user_id, userId),
      eq(suggestions.contact_id, contactId),
      eq(suggestions.status, "pending"),
    ))
    .all();

  return rows.map((r) => r.type);
}
