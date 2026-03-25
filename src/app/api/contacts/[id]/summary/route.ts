/**
 * Contact Conversation Summary — GET /api/contacts/:id/summary
 *
 * Uses OpenAI to generate a succinct summary of all conversations
 * with a contact based on their interaction history.
 *
 * Caches the summary in the contact's exa_data JSONB field and only
 * regenerates when the interaction count changes (i.e. new interactions).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import { getInteractions } from "@/services/interactions.service";
import { getOpenAI } from "@/lib/openai";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const contactId = params.id;
    const db = getDb();

    /* Fetch the contact (includes exa_data where we cache the summary) */
    const contact = db
      .select({ name: contacts.name, email: contacts.email, company: contacts.company, exa_data: contacts.exa_data })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.user_id, user!.id)))
      .get();

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    /* Fetch recent interactions (last 20) */
    const interactions = await getInteractions(user!.id, contactId, 20);

    if (interactions.length === 0) {
      return NextResponse.json({
        summary: "No conversations yet.",
        lastContactDate: null,
        interactionCount: 0,
      });
    }

    /* Check cached summary — skip OpenAI if interaction count hasn't changed */
    const cached = (contact.exa_data as Record<string, unknown>) ?? {};
    const cachedSummary = cached._cached_summary as string | undefined;
    const cachedCount = cached._summary_interaction_count as number | undefined;
    const cachedLastDate = cached._summary_last_date as string | undefined;

    if (
      cachedSummary &&
      cachedCount === interactions.length &&
      cachedLastDate === interactions[0].occurred_at
    ) {
      return NextResponse.json({
        summary: cachedSummary,
        lastContactDate: interactions[0].occurred_at,
        interactionCount: interactions.length,
      });
    }

    /* Build interaction context for the AI */
    const interactionLines = interactions.map((i) => {
      const date = new Date(i.occurred_at).toLocaleDateString();
      const type = i.type.replace("_", " ");
      const summary = i.ai_summary || i.snippet || i.subject;
      return `[${date}] ${type}: ${summary}`;
    });

    const prompt = `You are a PRM assistant. Summarize the relationship and key conversations with this contact in 2-3 sentences. Be succinct and focus on what matters: topics discussed, decisions made, and current status of the relationship.

Contact: ${contact.name} (${contact.email}${contact.company ? `, ${contact.company}` : ""})

Interaction history (newest first):
${interactionLines.join("\n")}

Provide a brief, actionable summary.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });

    const summary =
      response.choices[0]?.message?.content?.trim() ?? "Unable to generate summary.";

    /* Cache the summary in exa_data */
    db.update(contacts)
      .set({
        exa_data: {
          ...cached,
          _cached_summary: summary,
          _summary_interaction_count: interactions.length,
          _summary_last_date: interactions[0].occurred_at,
        },
      })
      .where(eq(contacts.id, contactId))
      .run();

    return NextResponse.json({
      summary,
      lastContactDate: interactions[0].occurred_at,
      interactionCount: interactions.length,
    });
  } catch (err) {
    console.error("[GET /api/contacts/:id/summary] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
