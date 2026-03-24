import { getDb } from "@/lib/db";
import { contacts, contactTags, deletedContacts } from "@/lib/db/schema";
import { eq, and, or, like, desc, asc, inArray } from "drizzle-orm";
import { Contact, ContactFilters } from "@/lib/types";
import crypto from "crypto";

export async function listContacts(userId: string, filters: ContactFilters = {}): Promise<Contact[]> {
  const db = getDb();
  const { search, tag, starred, sort_by = "name", sort_order = "asc" } = filters;

  let taggedContactIds: string[] | null = null;
  if (tag) {
    const tagRows = db.select({ contact_id: contactTags.contact_id })
      .from(contactTags)
      .innerJoin(contacts, eq(contactTags.contact_id, contacts.id))
      .where(and(eq(contacts.user_id, userId), eq(contactTags.tag, tag)))
      .all();
    taggedContactIds = tagRows.map((r) => r.contact_id);
    if (taggedContactIds.length === 0) return [];
  }

  const conditions: any[] = [eq(contacts.user_id, userId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      like(contacts.name, pattern),
      like(contacts.email, pattern),
      like(contacts.company, pattern),
    ));
  }

  if (taggedContactIds) {
    conditions.push(inArray(contacts.id, taggedContactIds));
  }

  if (starred) {
    conditions.push(eq(contacts.starred, true));
  }

  const sortMap: Record<string, any> = {
    warmth: contacts.warmth_score,
    warmth_score: contacts.warmth_score,
    recent: contacts.updated_at,
    updated_at: contacts.updated_at,
    name: contacts.name,
  };
  const sortColumn = sortMap[sort_by] || contacts.name;
  const orderFn = sort_order === "desc" ? desc : asc;

  const result = db.select().from(contacts)
    .where(and(...conditions))
    .orderBy(orderFn(sortColumn))
    .all();

  const contactIds = result.map((c) => c.id);
  if (contactIds.length === 0) return [];

  const allTags = db.select({ contact_id: contactTags.contact_id, tag: contactTags.tag })
    .from(contactTags)
    .where(inArray(contactTags.contact_id, contactIds))
    .all();

  const tagMap = new Map<string, string[]>();
  for (const row of allTags) {
    const existing = tagMap.get(row.contact_id) ?? [];
    existing.push(row.tag);
    tagMap.set(row.contact_id, existing);
  }

  return result.map((c) => ({
    ...c,
    tags: tagMap.get(c.id) ?? [],
  })) as any[];
}

export async function getContact(userId: string, contactId: string): Promise<Contact | null> {
  const db = getDb();

  const contact = db.select().from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId)))
    .get();

  if (!contact) return null;

  const tagRows = db.select({ tag: contactTags.tag }).from(contactTags)
    .where(eq(contactTags.contact_id, contactId)).all();

  return { ...contact, tags: tagRows.map((r) => r.tag) } as any;
}

export async function createContact(userId: string, input: Partial<Contact>): Promise<Contact> {
  const db = getDb();
  const id = crypto.randomUUID();

  db.insert(contacts).values({
    id,
    user_id: userId,
    name: input.name ?? "",
    email: input.email ?? "",
    company: input.company ?? "",
    title: input.title ?? "",
    linkedin_url: input.linkedin_url ?? "",
    warmth_score: input.warmth_score ?? 0,
  }).run();

  const result = db.select().from(contacts).where(eq(contacts.id, id)).get();
  return { ...result, tags: [] } as any;
}

export async function updateContact(userId: string, contactId: string, input: Partial<Contact>): Promise<Contact> {
  const db = getDb();
  const { id, user_id, created_at, tags, ...updateFields } = input;

  db.update(contacts)
    .set({ ...updateFields, updated_at: new Date().toISOString() })
    .where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId)))
    .run();

  const result = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!result) throw new Error("Contact not found");
  return result as any;
}

export async function deleteContact(userId: string, contactId: string): Promise<void> {
  const db = getDb();

  const contact = db.select({ email: contacts.email }).from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId))).get();

  if (contact?.email) {
    db.insert(deletedContacts).values({
      id: crypto.randomUUID(),
      user_id: userId,
      email: contact.email.toLowerCase(),
    }).onConflictDoNothing().run();
  }

  db.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId))).run();
}

export async function deleteContacts(userId: string, contactIds: string[]): Promise<number> {
  if (contactIds.length === 0) return 0;
  const db = getDb();

  const contactRows = db.select({ email: contacts.email }).from(contacts)
    .where(and(eq(contacts.user_id, userId), inArray(contacts.id, contactIds))).all();

  const emails = contactRows.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[];
  for (const email of emails) {
    db.insert(deletedContacts).values({ id: crypto.randomUUID(), user_id: userId, email }).onConflictDoNothing().run();
  }

  db.delete(contacts).where(and(eq(contacts.user_id, userId), inArray(contacts.id, contactIds))).run();
  return contactRows.length;
}

export async function deleteAllContacts(userId: string): Promise<number> {
  const db = getDb();
  const result = db.select({ id: contacts.id }).from(contacts).where(eq(contacts.user_id, userId)).all();
  db.delete(contacts).where(eq(contacts.user_id, userId)).run();
  return result.length;
}

export async function addTag(userId: string, contactId: string, tag: string): Promise<void> {
  const db = getDb();
  try {
    db.insert(contactTags).values({ id: crypto.randomUUID(), contact_id: contactId, tag }).onConflictDoNothing().run();
  } catch (err: any) {
    if (!err.message?.includes("UNIQUE constraint")) {
      throw new Error(`Failed to add tag: ${err.message}`);
    }
  }
}

export async function removeTag(userId: string, contactId: string, tag: string): Promise<void> {
  const db = getDb();
  db.delete(contactTags).where(and(eq(contactTags.contact_id, contactId), eq(contactTags.tag, tag))).run();
}
