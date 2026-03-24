import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

export async function resolveContact(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const db = getDb();
  const normalizedEmail = email.toLowerCase();

  // Check primary email
  const existing = db.select({ id: contacts.id }).from(contacts)
    .where(and(eq(contacts.user_id, userId), eq(contacts.email, normalizedEmail)))
    .get();

  if (existing) return existing.id;

  // Check other_emails (JSON array stored as text)
  const allUserContacts = db.select({ id: contacts.id, other_emails: contacts.other_emails }).from(contacts)
    .where(eq(contacts.user_id, userId))
    .all();

  for (const c of allUserContacts) {
    const others = (c.other_emails as string[] | null) ?? [];
    if (others.includes(normalizedEmail)) {
      return c.id;
    }
  }

  // Create new contact
  const id = crypto.randomUUID();
  db.insert(contacts).values({
    id,
    user_id: userId,
    email: normalizedEmail,
    name: name || email,
    company: "",
    title: "",
    linkedin_url: "",
    warmth_score: 0,
  }).run();

  return id;
}
