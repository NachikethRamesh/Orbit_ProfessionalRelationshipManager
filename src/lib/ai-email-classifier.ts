/**
 * AI Email Classifier — catches non-individual emails that slip past rule-based filters.
 *
 * Uses OpenAI gpt-4o-mini to classify a batch of email addresses in a single API call.
 * Fail-open: on any error, returns an empty set (no emails blocked).
 */
import { getOpenAI } from "@/lib/openai";

export interface EmailMetadata {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
}

/** Max contacts per AI call to stay within token limits */
const BATCH_SIZE = 80;

/**
 * Classifies a batch of emails/contacts and returns the set of IDs
 * that appear to be from non-individual senders (marketing, automated,
 * corporate, etc.).
 *
 * Returns an empty set on any error so that sync is never blocked.
 */
export async function classifyEmailBatch(
  emails: EmailMetadata[]
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();

  const inputIds = new Set(emails.map((e) => e.id));
  const allFiltered = new Set<string>();

  try {
    const openai = getOpenAI();

    /* Process in chunks to stay within token limits */
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE);
      const hasContent = chunk.some((e) => e.subject || e.snippet);

      /* Build the list — adapt format based on available data */
      const emailList = chunk
        .map((e) => {
          let entry = `ID: ${e.id}\nEmail: ${e.fromName} <${e.fromEmail}>`;
          if (e.subject) entry += `\nSubject: ${e.subject}`;
          if (e.snippet) entry += `\nSnippet: ${e.snippet}`;
          return entry;
        })
        .join("\n---\n");

      /* Use different prompts depending on whether we have email content */
      const systemPrompt = hasContent
        ? `You classify email senders. Given a list of emails with metadata, identify which are NOT from individual people.

Non-individual senders include:
- Companies, brands, or services (e.g. "Uber" <receipts@uber.com>, "LinkedIn" <messages-noreply@linkedin.com>)
- Marketing, newsletters, promotions, automated notifications
- Corporate/team addresses (support@, team@, hello@, info@)
- Transactional senders (order confirmations, shipping updates, receipts)
- Social media notifications
- SaaS product notifications (GitHub, Jira, Slack, etc.)
- Mailing lists, forums, communities

Individual senders are real people writing personal or professional emails — even if they work at a company. Look at the name AND the email address together.
When in doubt, classify as individual. It's better to include a few automated senders than to filter out real people.

Return ONLY a JSON array of the IDs that are non-individual. If all are individuals, return [].`
        : `You classify email contacts. Given a list of contacts with name and email address, identify which are NOT individual people.

Non-individual contacts include:
- Company or brand names as the display name (e.g. "Uber", "Netflix", "LinkedIn")
- Generic role addresses: support@, team@, hello@, info@, billing@, admin@, etc.
- Addresses with company/product names as the local part (e.g. uber@uber.com, noreply@company.com)
- Automated senders: notifications, alerts, updates, digest, newsletter
- SaaS/platform addresses (anything @github.com, @linkedin.com, etc.)
- Addresses with no real person name (empty name or name matches email)

Individual contacts are real people — they have a human name (first + last or first name) and a personal or work email that looks like it belongs to a person (e.g. john.doe@company.com, jane@gmail.com).

Be conservative — only flag contacts that are CLEARLY not a real person. When in doubt, classify as individual. It's better to let in a few non-individual contacts than to miss real people.

Return ONLY a JSON array of the IDs that are non-individual. If all are individuals, return [].`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: emailList },
        ],
      });

      const text = response.choices[0]?.message?.content?.trim() ?? "[]";

      /* Extract JSON array — handle cases where model wraps in markdown */
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) continue;

      for (const id of parsed) {
        if (typeof id === "string" && inputIds.has(id)) {
          allFiltered.add(id);
        }
      }
    }

    return allFiltered;
  } catch (err) {
    console.warn("[ai-email-classifier] Classification failed, skipping AI filter:", err);
    return new Set();
  }
}
