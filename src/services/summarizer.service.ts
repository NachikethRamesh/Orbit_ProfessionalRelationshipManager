/**
 * Summarizer Service — AI Interaction Summarization (Server-only)
 *
 * Uses OpenAI's gpt-4o-mini to generate concise, PRM-relevant summaries
 * of email and meeting interactions. Summaries help the user quickly
 * understand past conversations without reading full threads.
 */

import { getOpenAI } from "@/lib/openai";

/**
 * Generates a 1-2 sentence AI summary of an interaction.
 *
 * Prompt design:
 *  - The system prompt positions the AI as a PRM assistant whose
 *    job is to create short, actionable summaries.
 *  - We instruct it to focus on: decisions made, commitments given,
 *    next steps agreed upon, and overall sentiment (positive/neutral/negative).
 *  - The 1-2 sentence limit keeps summaries scannable in list views.
 *  - We use gpt-4o-mini because summaries are high-volume, low-complexity
 *    tasks where speed and cost matter more than deep reasoning.
 *  - The user message provides the interaction type (email/meeting) plus
 *    the subject, snippet, and body text for context.
 *
 * @param params - The interaction data to summarize.
 * @param params.subject - The email subject line or meeting title.
 * @param params.snippet - A short preview of the content (e.g., Gmail snippet).
 * @param params.body_text - The full body text (may be empty for meetings).
 * @param params.type - The interaction type: "email_sent", "email_received", or "meeting".
 * @returns A 1-2 sentence summary string.
 */
export async function summarizeInteraction({
  subject,
  snippet,
  body_text,
  type,
}: {
  subject: string;
  snippet: string;
  body_text: string;
  type: string;
}): Promise<string> {
  /*
   * System prompt: defines the AI's role and output format.
   * We explicitly ask for decisions, commitments, next steps, and sentiment
   * because these are the most valuable signals for a PRM user.
   */
  const systemPrompt = `You are a PRM assistant. Your job is to summarize interactions (emails and meetings) in 1-2 concise sentences.

Focus on:
- Key decisions or outcomes
- Commitments made by either party
- Next steps or action items mentioned
- Overall sentiment (positive, neutral, or negative)

Keep summaries factual, professional, and scannable. Do not include greetings or sign-offs. If the content is too short or vague to summarize meaningfully, say so briefly.`;

  /*
   * User message: provides the raw interaction data.
   * We include all available fields so the model has maximum context.
   */
  const userMessage = `Summarize this ${type.replace("_", " ")}:

Subject: ${subject}
Preview: ${snippet}
${body_text ? `Full text: ${body_text}` : ""}`;

  /* Call gpt-4o-mini for fast, cost-effective summarization */
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 150,
    temperature: 0.3, // Low temperature for consistent, factual output
  });

  /* Extract the summary text from the response */
  const summary = response.choices[0]?.message?.content?.trim() ?? "";

  return summary;
}
