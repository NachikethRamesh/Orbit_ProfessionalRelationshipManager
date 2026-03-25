/**
 * Meeting Brief Service — AI-Generated Pre-Meeting Briefs (Server-only)
 *
 * Generates a structured markdown brief to prepare the user for an
 * upcoming meeting with a contact. The brief synthesizes contact info
 * and recent interaction history into actionable talking points.
 */

import { getOpenAI } from "@/lib/openai";
import { Contact, Interaction } from "@/lib/types";

/**
 * Generates a structured meeting brief for an upcoming meeting with a contact.
 *
 * The brief is organized into four sections, each serving a specific purpose:
 *
 * 1. **Who They Are** — Contact profile summary (name, title, company, enrichment data).
 *    Helps the user remember who they're meeting with, especially for infrequent contacts.
 *
 * 2. **Your History** — Summary of recent interactions and relationship context.
 *    Shows the trajectory of the relationship so the user walks in informed.
 *
 * 3. **Talking Points** — Specific topics to bring up based on past conversations.
 *    Extracts unresolved threads, follow-ups, and opportunities from interaction history.
 *
 * 4. **Open Items** — Unresolved commitments or action items from either party.
 *    Ensures nothing falls through the cracks.
 *
 * We use gpt-4o because generating a good brief requires synthesizing multiple
 * interactions and reasoning about what's most relevant for the upcoming meeting.
 *
 * @param contact - The contact the user is meeting with (includes profile and enrichment data).
 * @param interactions - Recent interactions with this contact (used for history/context).
 * @param meetingSubject - The title/subject of the upcoming meeting.
 * @returns A markdown-formatted brief string ready to display in the UI.
 */
export async function generateMeetingBrief(
  contact: Contact,
  interactions: Interaction[],
  meetingSubject: string
): Promise<string> {
  /* Take the most recent interactions for context (up to 10) */
  const recentInteractions = interactions.slice(0, 10);

  /*
   * System prompt: instructs the AI to produce a structured markdown brief.
   * Each section heading is defined so the output is consistent and parseable.
   */
  const systemPrompt = `You are a PRM assistant preparing a meeting brief. Generate a concise, actionable brief in markdown format with these four sections:

## Who They Are
A brief profile of the contact — their role, company, and any notable background info. Use enrichment data if available.

## Your History
Summarize the relationship: how long you've been in contact, frequency of interactions, key milestones, and the overall trajectory (growing, stable, or fading).

## Talking Points
3-5 specific topics to bring up in the meeting, derived from recent interactions. Include:
- Unresolved threads or questions from past conversations
- Topics they've expressed interest in
- Opportunities to deepen the relationship

## Open Items
Any commitments, promises, or action items from either party that haven't been resolved. If none, say "No open items identified."

Keep the brief professional, concise, and focused on what's actionable for the upcoming meeting. Use bullet points for readability.`;

  /*
   * User message: provides all the context the AI needs to generate the brief.
   * We include the meeting subject so talking points can be tailored to the agenda.
   */
  const interactionSummary = recentInteractions
    .map(
      (i) =>
        `- [${i.occurred_at}] ${i.type.replace("_", " ")}: "${i.subject}" — ${i.ai_summary || i.snippet || "No summary"}`
    )
    .join("\n");

  const enrichmentInfo = contact.exa_data
    ? `\nEnrichment data: ${JSON.stringify(contact.exa_data)}`
    : "";

  const userMessage = `Upcoming meeting: "${meetingSubject}"

Contact: ${contact.name}
Title: ${contact.title || "Unknown"}
Company: ${contact.company || "Unknown"}
Email: ${contact.email}
LinkedIn: ${contact.linkedin_url || "Not available"}
Warmth Score: ${contact.warmth_score}/100${enrichmentInfo}

Recent interactions:
${interactionSummary || "No prior interactions recorded."}`;

  /* Call gpt-4o for high-quality synthesis and reasoning */
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 1000,
    temperature: 0.5, // Balanced: creative enough for talking points, factual for history
  });

  /* Return the markdown brief directly */
  const brief = response.choices[0]?.message?.content?.trim() ?? "";

  return brief;
}
