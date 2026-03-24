import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getOpenAI } from "@/lib/openai";

const EXA_API_URL = "https://api.exa.ai/search";

interface ExtractedFields {
  linkedin_url: string;
  phone: string;
  location: string;
  company: string;
  title: string;
  other_emails: string[];
}

async function aiExtract(name: string, email: string, company: string, results: any[]): Promise<ExtractedFields> {
  const empty: ExtractedFields = { linkedin_url: "", phone: "", location: "", company: "", title: "", other_emails: [] };
  if (results.length === 0) return empty;

  const resultSummaries = results.map((r, i) => {
    const parts: string[] = [];
    if (r.url) parts.push(`URL: ${r.url}`);
    if (r.title) parts.push(`Title: ${r.title}`);
    if (r.text) parts.push(`Text: ${r.text.slice(0, 2000)}`);
    if (Array.isArray(r.highlights)) {
      const hl = r.highlights.map((h: any) => (typeof h === "string" ? h : h?.text ?? "")).filter(Boolean).join(" | ");
      if (hl) parts.push(`Highlights: ${hl}`);
    }
    return `--- Result ${i + 1} ---\n${parts.join("\n")}`;
  });

  const prompt = `You are a contact data extraction engine. Given web search results about a person, extract their professional information.

TARGET PERSON:
- Name: ${name}
- Email: ${email}
${company ? `- Company: ${company}` : "- Company: unknown"}

SEARCH RESULTS:
${resultSummaries.join("\n\n")}

INSTRUCTIONS:
1. Only extract data that belongs to the TARGET PERSON (name: ${name}).
2. For LinkedIn, return the full URL. Only include if it clearly belongs to this person.
3. For phone, include country code if available.
4. For location, return in "City, State/Region, Country" format.
5. For company, return the current employer name. Only if different from or more specific than "${company || "unknown"}".
6. For title/role, return their current job title.
7. For other_emails, return any additional email addresses found (exclude ${email}).
8. If not confident, leave as empty string or empty array.

Return ONLY valid JSON: {"linkedin_url":"","phone":"","location":"","company":"","title":"","other_emails":[]}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300, temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return empty;

    const parsed = JSON.parse(content);
    return {
      linkedin_url: typeof parsed.linkedin_url === "string" ? parsed.linkedin_url.trim() : "",
      phone: typeof parsed.phone === "string" ? parsed.phone.trim() : "",
      location: typeof parsed.location === "string" ? parsed.location.trim() : "",
      company: typeof parsed.company === "string" ? parsed.company.trim() : "",
      title: typeof parsed.title === "string" ? parsed.title.trim() : "",
      other_emails: Array.isArray(parsed.other_emails) ? parsed.other_emails.filter((e: any) => typeof e === "string" && e.includes("@")) : [],
    };
  } catch (err) {
    console.error("[exa-enrich] AI extraction failed:", err);
    return empty;
  }
}

async function aiWebSearchAugment(name: string, email: string, company: string, missingFields: string[]): Promise<Partial<ExtractedFields>> {
  if (missingFields.length === 0) return {};

  const searchQuery = `Find professional information about ${name}` +
    (company ? ` who works at ${company}` : "") +
    ` with email ${email}. I need: ${missingFields.join(", ")}.`;

  try {
    const openai = getOpenAI();
    const response = await (openai as any).responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search" }],
      input: searchQuery + `\n\nReturn ONLY valid JSON: {"linkedin_url":"","phone":"","location":"","company":"","title":"","other_emails":[]}`,
    });

    let content = "";
    if (response.output) {
      for (const item of response.output) {
        if (item.type === "message" && item.content) {
          for (const block of item.content) {
            if (block.type === "output_text" || block.type === "text") {
              content += block.text ?? "";
            }
          }
        }
      }
    }

    if (!content) return {};
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]);
    const result: Partial<ExtractedFields> = {};
    if (missingFields.includes("linkedin_url") && parsed.linkedin_url) result.linkedin_url = String(parsed.linkedin_url).trim();
    if (missingFields.includes("phone") && parsed.phone) result.phone = String(parsed.phone).trim();
    if (missingFields.includes("location") && parsed.location) result.location = String(parsed.location).trim();
    if (missingFields.includes("company") && parsed.company) result.company = String(parsed.company).trim();
    if (missingFields.includes("title") && parsed.title) result.title = String(parsed.title).trim();
    if (missingFields.includes("other_emails") && Array.isArray(parsed.other_emails)) {
      result.other_emails = parsed.other_emails.filter((e: any) => typeof e === "string" && e.includes("@"));
    }
    return result;
  } catch (err) {
    console.log(`[exa-enrich] AI web search not available:`, (err as any)?.message ?? err);
    return {};
  }
}

export async function enrichContact(userId: string, contactId: string): Promise<Record<string, unknown> | null> {
  const db = getDb();

  const contact = db.select({ name: contacts.name, company: contacts.company, email: contacts.email, linkedin_url: contacts.linkedin_url, title: contacts.title, phone: contacts.phone, location: contacts.location, other_emails: contacts.other_emails })
    .from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId))).get();

  if (!contact) throw new Error(`Contact not found: ${contactId}`);

  const queryParts = [contact.name, contact.email];
  if (contact.company) queryParts.push(contact.company);

  const exaApiKey = process.env.EXA_API_KEY;
  if (!exaApiKey) throw new Error("EXA_API_KEY environment variable is not set.");

  const response = await fetch(EXA_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": exaApiKey },
    body: JSON.stringify({
      query: queryParts.join(" "), type: "auto", category: "people", numResults: 5,
      contents: { text: { maxCharacters: 3000 }, highlights: true },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error (${response.status}): ${errorText}`);
  }

  const exaData = (await response.json()) as Record<string, unknown>;
  const results = (exaData.results ?? []) as any[];

  const extracted = await aiExtract(contact.name ?? "", contact.email, contact.company ?? "", results);

  const missingFields: string[] = [];
  if (!extracted.linkedin_url && !contact.linkedin_url) missingFields.push("linkedin_url");
  if (!extracted.phone && !contact.phone) missingFields.push("phone");
  if (!extracted.location && !contact.location) missingFields.push("location");
  if (!extracted.company && !contact.company) missingFields.push("company");
  if (!extracted.title && !contact.title) missingFields.push("title");

  if (missingFields.length > 0) {
    const augmented = await aiWebSearchAugment(contact.name ?? "", contact.email, contact.company || extracted.company, missingFields);
    if (augmented.linkedin_url && !extracted.linkedin_url) extracted.linkedin_url = augmented.linkedin_url;
    if (augmented.phone && !extracted.phone) extracted.phone = augmented.phone;
    if (augmented.location && !extracted.location) extracted.location = augmented.location;
    if (augmented.company && !extracted.company) extracted.company = augmented.company;
    if (augmented.title && !extracted.title) extracted.title = augmented.title;
    if (augmented.other_emails && augmented.other_emails.length > 0 && extracted.other_emails.length === 0) extracted.other_emails = augmented.other_emails;
  }

  const updateFields: Record<string, unknown> = { exa_data: exaData };
  if (extracted.linkedin_url && !contact.linkedin_url) updateFields.linkedin_url = extracted.linkedin_url;
  if (extracted.phone && !contact.phone) updateFields.phone = extracted.phone;
  if (extracted.location && !contact.location) updateFields.location = extracted.location;
  if (extracted.company && !contact.company) updateFields.company = extracted.company;
  if (extracted.title && !contact.title) updateFields.title = extracted.title;
  const contactOtherEmails = (contact.other_emails as string[] | null) ?? [];
  if (extracted.other_emails.length > 0 && contactOtherEmails.length === 0) updateFields.other_emails = extracted.other_emails;

  db.update(contacts).set(updateFields).where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId))).run();

  return exaData;
}
