import { getDb } from "@/lib/db";
import { interactions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { Interaction } from "@/lib/types";
import crypto from "crypto";

export async function getInteractions(
  userId: string,
  contactId: string,
  limit: number = 50
): Promise<Interaction[]> {
  const db = getDb();

  const results = db.select().from(interactions)
    .where(and(eq(interactions.user_id, userId), eq(interactions.contact_id, contactId)))
    .orderBy(desc(interactions.occurred_at))
    .limit(limit)
    .all();

  return results as Interaction[];
}

export async function createInteraction(
  data: Omit<Interaction, "id" | "created_at">
): Promise<Interaction | null> {
  const db = getDb();
  const id = crypto.randomUUID();

  try {
    db.insert(interactions).values({
      id,
      ...data,
    }).onConflictDoNothing().run();

    const result = db.select().from(interactions).where(eq(interactions.id, id)).get();
    return (result as Interaction) ?? null;
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint")) return null;
    throw new Error(`Failed to create interaction: ${err.message}`);
  }
}

export async function getUnsummarized(userId: string): Promise<Interaction[]> {
  const db = getDb();

  const results = db.select().from(interactions)
    .where(and(eq(interactions.user_id, userId), isNull(interactions.ai_summary)))
    .orderBy(desc(interactions.occurred_at))
    .all();

  return results as Interaction[];
}

export async function updateSummary(
  interactionId: string,
  summary: string
): Promise<void> {
  const db = getDb();

  db.update(interactions)
    .set({ ai_summary: summary })
    .where(eq(interactions.id, interactionId))
    .run();
}
