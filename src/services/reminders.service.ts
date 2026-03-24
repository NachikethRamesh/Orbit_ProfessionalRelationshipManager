import { getDb } from "@/lib/db";
import { reminders, contacts } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { Reminder } from "@/lib/types";
import crypto from "crypto";

export async function listReminders(
  userId: string,
  status?: string
): Promise<Reminder[]> {
  const db = getDb();

  const rows = db.select({
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
    .where(
      status
        ? and(eq(reminders.user_id, userId), eq(reminders.status, status))
        : eq(reminders.user_id, userId)
    )
    .orderBy(asc(reminders.remind_at))
    .all();

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    contact_id: r.contact_id ?? "",
    suggestion_id: r.suggestion_id ?? "",
    title: r.title,
    remind_at: r.remind_at,
    status: (r.status ?? "pending") as "pending" | "completed" | "dismissed",
    created_at: r.created_at ?? "",
    contact: r.contact_id_ref ? { id: r.contact_id_ref, name: r.contact_name ?? "", email: r.contact_email ?? "" } : undefined,
  })) as Reminder[];
}

export async function createReminder(
  data: Omit<Reminder, "id" | "created_at" | "contact">
): Promise<Reminder> {
  const db = getDb();
  const id = crypto.randomUUID();

  db.insert(reminders).values({
    id,
    user_id: data.user_id,
    contact_id: data.contact_id || null,
    suggestion_id: data.suggestion_id || null,
    title: data.title,
    remind_at: data.remind_at,
    status: data.status ?? "pending",
  }).run();

  const result = db.select().from(reminders).where(eq(reminders.id, id)).get();
  return result as unknown as Reminder;
}

export async function updateReminder(
  userId: string,
  id: string,
  updates: Partial<Pick<Reminder, "status" | "remind_at">>
): Promise<Reminder> {
  const db = getDb();

  db.update(reminders)
    .set(updates)
    .where(and(eq(reminders.id, id), eq(reminders.user_id, userId)))
    .run();

  const result = db.select().from(reminders).where(eq(reminders.id, id)).get();
  if (!result) throw new Error("Reminder not found");
  return result as unknown as Reminder;
}
