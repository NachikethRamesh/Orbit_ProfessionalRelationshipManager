import { getDb } from "@/lib/db";
import { contacts, reminders, interactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export const PREFIX_COLD = "[cold] ";
export const PREFIX_NO_CONTACT = "[no-contact] ";
export const PREFIX_FOLLOW_UP = "[follow-up] ";
export const PREFIX_MEETING = "[meeting] ";

const FOLLOW_UP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const NO_CONTACT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MEETING_DEBRIEF_WINDOW_MS = 24 * 60 * 60 * 1000;
const MEETING_DEBRIEF_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export async function generateAutoReminders(
  userId: string
): Promise<{ created: number; dismissed: number }> {
  const db = getDb();
  let created = 0;
  let dismissed = 0;

  const allContacts = db.select({ id: contacts.id, name: contacts.name, email: contacts.email, warmth_score: contacts.warmth_score })
    .from(contacts).where(eq(contacts.user_id, userId)).all();

  const pendingReminders = db.select({ id: reminders.id, title: reminders.title, contact_id: reminders.contact_id, created_at: reminders.created_at })
    .from(reminders).where(and(eq(reminders.user_id, userId), eq(reminders.status, "pending"))).all();

  const allInteractions = db.select({ contact_id: interactions.contact_id, type: interactions.type, subject: interactions.subject, occurred_at: interactions.occurred_at, source_id: interactions.source_id })
    .from(interactions).where(eq(interactions.user_id, userId)).orderBy(desc(interactions.occurred_at)).all();

  if (allContacts.length === 0) return { created, dismissed };

  const pendingByContact = new Map<string, typeof pendingReminders>();
  for (const r of pendingReminders) {
    const arr = pendingByContact.get(r.contact_id ?? "") ?? [];
    arr.push(r);
    pendingByContact.set(r.contact_id ?? "", arr);
  }

  const lastInteractionDate = new Map<string, string>();
  const lastSentEmail = new Map<string, { occurred_at: string; subject: string | null }>();
  const lastReceivedDate = new Map<string, string>();
  const recentMeetings = new Map<string, { occurred_at: string; subject: string | null }[]>();

  for (const i of allInteractions) {
    if (!lastInteractionDate.has(i.contact_id)) {
      lastInteractionDate.set(i.contact_id, i.occurred_at);
    }
    if (i.type === "email_sent" && !lastSentEmail.has(i.contact_id)) {
      lastSentEmail.set(i.contact_id, { occurred_at: i.occurred_at, subject: i.subject });
    }
    if (i.type === "email_received" && !lastReceivedDate.has(i.contact_id)) {
      lastReceivedDate.set(i.contact_id, i.occurred_at);
    }
    if (i.type === "meeting") {
      const arr = recentMeetings.get(i.contact_id) ?? [];
      arr.push({ occurred_at: i.occurred_at, subject: i.subject });
      recentMeetings.set(i.contact_id, arr);
    }
  }

  const now = Date.now();
  const remindAt = new Date(now + MEETING_DEBRIEF_WINDOW_MS).toISOString();

  for (const contact of allContacts) {
    const contactPending = pendingByContact.get(contact.id) ?? [];
    const lastDate = lastInteractionDate.get(contact.id);

    const hasPending = (prefix: string) =>
      contactPending.some((r) => r.title.startsWith(prefix));

    // AUTO-DISMISS
    for (const reminder of contactPending) {
      const isCold = reminder.title.startsWith(PREFIX_COLD);
      const isNoContact = reminder.title.startsWith(PREFIX_NO_CONTACT);
      const isFollowUp = reminder.title.startsWith(PREFIX_FOLLOW_UP);

      if ((isCold || isNoContact) && lastDate && new Date(lastDate) > new Date(reminder.created_at ?? "")) {
        db.update(reminders).set({ status: "completed" }).where(eq(reminders.id, reminder.id)).run();
        dismissed++;
        continue;
      }

      if (isFollowUp) {
        const replyDate = lastReceivedDate.get(contact.id);
        if (replyDate && new Date(replyDate) > new Date(reminder.created_at ?? "")) {
          db.update(reminders).set({ status: "completed" }).where(eq(reminders.id, reminder.id)).run();
          dismissed++;
        }
      }
    }

    // RULE 1: Cold contact alert
    if ((contact.warmth_score ?? 0) < 20 && (contact.warmth_score ?? 0) > 0 && !hasPending(PREFIX_COLD)) {
      db.insert(reminders).values({
        id: crypto.randomUUID(),
        user_id: userId,
        contact_id: contact.id,
        title: `${PREFIX_COLD}Reach out to ${contact.name} — relationship is cooling`,
        remind_at: remindAt,
        status: "pending",
        suggestion_id: null,
      }).run();
      created++;
    }

    // RULE 2: No-contact timeout
    if ((contact.warmth_score ?? 0) > 60 && lastDate) {
      const daysSince = Math.floor((now - new Date(lastDate).getTime()) / (24 * 60 * 60 * 1000));
      if (daysSince >= 30 && !hasPending(PREFIX_NO_CONTACT)) {
        db.insert(reminders).values({
          id: crypto.randomUUID(),
          user_id: userId,
          contact_id: contact.id,
          title: `${PREFIX_NO_CONTACT}It's been ${daysSince} days since you talked to ${contact.name}`,
          remind_at: remindAt,
          status: "pending",
          suggestion_id: null,
        }).run();
        created++;
      }
    }

    // RULE 3: Follow-up nudge
    const sent = lastSentEmail.get(contact.id);
    if (sent) {
      const sentTime = new Date(sent.occurred_at).getTime();
      const replyDate = lastReceivedDate.get(contact.id);
      const hasReplyAfterSent = replyDate && new Date(replyDate).getTime() > sentTime;

      if (!hasReplyAfterSent && now - sentTime > FOLLOW_UP_WINDOW_MS && !hasPending(PREFIX_FOLLOW_UP)) {
        const subject = sent.subject || "your last email";
        db.insert(reminders).values({
          id: crypto.randomUUID(),
          user_id: userId,
          contact_id: contact.id,
          title: `${PREFIX_FOLLOW_UP}Follow up with ${contact.name} — no reply to "${subject}"`,
          remind_at: remindAt,
          status: "pending",
          suggestion_id: null,
        }).run();
        created++;
      }
    }

    // RULE 4: Post-meeting debrief
    const meetings = recentMeetings.get(contact.id) ?? [];
    for (const meeting of meetings) {
      const meetingTime = new Date(meeting.occurred_at).getTime();
      const elapsed = now - meetingTime;

      if (elapsed >= MEETING_DEBRIEF_WINDOW_MS && elapsed <= MEETING_DEBRIEF_MAX_AGE_MS && !hasPending(PREFIX_MEETING)) {
        const meetingSubject = meeting.subject || "your meeting";
        db.insert(reminders).values({
          id: crypto.randomUUID(),
          user_id: userId,
          contact_id: contact.id,
          title: `${PREFIX_MEETING}Send follow-up notes to ${contact.name} from "${meetingSubject}"`,
          remind_at: new Date().toISOString(),
          status: "pending",
          suggestion_id: null,
        }).run();
        created++;
        break;
      }
    }
  }

  return { created, dismissed };
}
