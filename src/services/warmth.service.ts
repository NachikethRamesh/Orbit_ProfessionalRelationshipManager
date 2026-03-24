import { getDb } from "@/lib/db";
import { contacts, interactions } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { Interaction } from "@/lib/types";

const TYPE_WEIGHTS: Record<string, number> = {
  meeting: 3,
  email_sent: 2,
  email_received: 1,
};

const DECAY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const POINTS_PER_WEIGHT = 10;

export function calculateWarmthScore(interactionList: Interaction[]): number {
  const now = Date.now();
  let totalScore = 0;

  for (const interaction of interactionList) {
    const weight = TYPE_WEIGHTS[interaction.type] ?? 1;
    const occurredAt = new Date(interaction.occurred_at).getTime();
    const ageMs = now - occurredAt;
    const freshness = Math.max(0, 1 - ageMs / DECAY_WINDOW_MS);
    totalScore += weight * POINTS_PER_WEIGHT * freshness;
  }

  return Math.min(100, Math.round(totalScore));
}

export async function recalculateAllWarmth(userId: string): Promise<void> {
  const db = getDb();

  const allContacts = db.select({ id: contacts.id }).from(contacts).where(eq(contacts.user_id, userId)).all();

  if (allContacts.length === 0) return;

  const cutoffDate = new Date(Date.now() - DECAY_WINDOW_MS).toISOString();
  const allInteractions = db.select().from(interactions)
    .where(and(eq(interactions.user_id, userId), gte(interactions.occurred_at, cutoffDate)))
    .all() as Interaction[];

  const interactionsByContact = new Map<string, Interaction[]>();
  for (const interaction of allInteractions) {
    const existing = interactionsByContact.get(interaction.contact_id) ?? [];
    existing.push(interaction);
    interactionsByContact.set(interaction.contact_id, existing);
  }

  for (const contact of allContacts) {
    const contactInteractions = interactionsByContact.get(contact.id) ?? [];
    const warmthScore = calculateWarmthScore(contactInteractions);
    db.update(contacts).set({ warmth_score: warmthScore }).where(eq(contacts.id, contact.id)).run();
  }
}
