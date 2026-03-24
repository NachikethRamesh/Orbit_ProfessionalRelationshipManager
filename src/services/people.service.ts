import { google } from "googleapis";
import { getValidAccessToken } from "@/services/auth.service";
import { getDb } from "@/lib/db";
import { contacts, deletedContacts } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { isNonIndividualEmail } from "@/lib/email-filter";
import { classifyEmailBatch, EmailMetadata } from "@/lib/ai-email-classifier";
import crypto from "crypto";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "aol.com", "aim.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "pm.me",
  "zoho.com", "zohomail.com", "mail.com", "email.com", "yandex.com", "yandex.ru",
  "gmx.com", "gmx.net", "fastmail.com", "tutanota.com", "tuta.io", "hey.com",
]);

function isCompanyEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return !FREE_EMAIL_DOMAINS.has(domain);
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

function syntheticEmailForPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `phone+${digits}@orbit.local`;
}

interface ContactCandidate {
  emails: string[];
  name: string;
  company: string;
  title: string;
  phone: string;
  source: "other_contacts" | "google_contacts";
  primaryEmail: string;
  otherEmails: string[];
}

export async function importGoogleContacts(
  userId: string,
  accountId: string
): Promise<{ imported: number; skipped: number; noEmail: number; phoneOnly: number; total: number; errors: string[] }> {
  const accessToken = await getValidAccessToken(accountId);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const people = google.people({ version: "v1", auth });
  const db = getDb();

  let imported = 0;
  let skipped = 0;
  let noEmail = 0;
  let phoneOnly = 0;
  let total = 0;
  const errors: string[] = [];

  const deletedRows = db.select({ email: deletedContacts.email }).from(deletedContacts).where(eq(deletedContacts.user_id, userId)).all();
  const deletedEmailSet = new Set(deletedRows.map((r) => r.email));

  const seenEmails = new Set<string>();
  const personMap = new Map<string, { emails: string[]; name: string; company: string; title: string; phone: string; source: "other_contacts" | "google_contacts" }>();

  function collectPerson(
    person: { names?: { displayName?: string | null }[]; emailAddresses?: { value?: string | null }[]; phoneNumbers?: { canonicalForm?: string | null; value?: string | null }[]; organizations?: { name?: string | null; title?: string | null }[] },
    source: "other_contacts" | "google_contacts"
  ) {
    const allEmails = (person.emailAddresses ?? []).map((e) => e.value?.toLowerCase().trim()).filter((e): e is string => !!e);
    const rawPhone = person.phoneNumbers?.[0]?.canonicalForm || person.phoneNumbers?.[0]?.value || "";
    const phone = rawPhone ? normalizePhone(rawPhone) : "";

    if (allEmails.length === 0) {
      if (phone) {
        const syntheticEmail = syntheticEmailForPhone(phone);
        if (seenEmails.has(syntheticEmail)) { skipped++; return; }
        seenEmails.add(syntheticEmail);
        const name = person.names?.[0]?.displayName || phone;
        const company = person.organizations?.[0]?.name ?? "";
        const title = person.organizations?.[0]?.title ?? "";
        const nameKey = name.toLowerCase().trim();
        const existing = personMap.get(nameKey);
        if (existing) {
          if (!existing.phone && phone) existing.phone = phone;
          if (!existing.company && company) existing.company = company;
          if (!existing.title && title) existing.title = title;
          if (source === "google_contacts") existing.source = "google_contacts";
        } else {
          personMap.set(nameKey, { emails: [syntheticEmail], name, company, title, phone, source });
        }
        phoneOnly++;
      } else { noEmail++; }
      return;
    }

    const validEmails = allEmails.filter((email) => !deletedEmailSet.has(email) && !isNonIndividualEmail(email));
    if (validEmails.length === 0) { skipped++; return; }

    const newEmails = validEmails.filter((e) => !seenEmails.has(e));
    if (newEmails.length === 0) { skipped++; return; }

    for (const e of validEmails) seenEmails.add(e);

    const name = person.names?.[0]?.displayName || validEmails[0];
    const company = person.organizations?.[0]?.name ?? "";
    const title = person.organizations?.[0]?.title ?? "";
    const nameKey = name.toLowerCase().trim();
    const existing = personMap.get(nameKey);

    if (existing) {
      for (const e of validEmails) { if (!existing.emails.includes(e)) existing.emails.push(e); }
      if (!existing.company && company) existing.company = company;
      if (!existing.title && title) existing.title = title;
      if (!existing.phone && phone) existing.phone = phone;
      if (source === "google_contacts") existing.source = "google_contacts";
    } else {
      personMap.set(nameKey, { emails: validEmails, name, company, title, phone, source });
    }
  }

  // Other Contacts
  try {
    let nextPageToken: string | undefined;
    do {
      const response = await people.otherContacts.list({ pageSize: 200, readMask: "names,emailAddresses,phoneNumbers", pageToken: nextPageToken });
      const otherContacts = response.data.otherContacts ?? [];
      total += otherContacts.length;
      nextPageToken = response.data.nextPageToken ?? undefined;
      for (const person of otherContacts) collectPerson(person, "other_contacts");
    } while (nextPageToken);
  } catch (err: unknown) {
    errors.push(`Other Contacts API error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Google Contacts
  try {
    let nextPageToken: string | undefined;
    do {
      const response = await people.people.connections.list({ resourceName: "people/me", personFields: "names,emailAddresses,phoneNumbers,organizations", pageSize: 200, pageToken: nextPageToken });
      const connections = response.data.connections ?? [];
      total += connections.length;
      nextPageToken = response.data.nextPageToken ?? undefined;
      for (const person of connections) collectPerson(person, "google_contacts");
    } while (nextPageToken);
  } catch (err: unknown) {
    errors.push(`Google Contacts API error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const candidates: ContactCandidate[] = [];
  for (const entry of personMap.values()) {
    const companyEmails = entry.emails.filter(isCompanyEmail);
    const freeEmails = entry.emails.filter((e) => !isCompanyEmail(e));
    const primaryEmail = companyEmails[0] ?? freeEmails[0];
    const otherEmails = entry.emails.filter((e) => e !== primaryEmail);
    candidates.push({ emails: entry.emails, name: entry.name, company: entry.company, title: entry.title, phone: entry.phone, source: entry.source, primaryEmail, otherEmails });
  }

  // AI classification
  const otherCandidates = candidates.filter((c) => c.source === "other_contacts");
  const aiInput: EmailMetadata[] = otherCandidates.map((c) => ({ id: c.primaryEmail, fromEmail: c.primaryEmail, fromName: c.name, subject: "", snippet: "" }));
  const aiFilteredIds = await classifyEmailBatch(aiInput);

  // Import
  for (const candidate of candidates) {
    if (aiFilteredIds.has(candidate.primaryEmail)) { skipped++; continue; }

    const existingContacts = db.select({ id: contacts.id, email: contacts.email, phone: contacts.phone })
      .from(contacts).where(and(eq(contacts.user_id, userId), inArray(contacts.email, candidate.emails))).all();

    const isPhoneOnly = candidate.primaryEmail.endsWith("@orbit.local");
    if (!existingContacts.length && isPhoneOnly && candidate.phone) {
      const phoneMatch = db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.user_id, userId), eq(contacts.phone, candidate.phone))).limit(1).all();
      if (phoneMatch.length > 0) { skipped++; continue; }
    }

    if (existingContacts.length > 0) {
      const existingContact = existingContacts[0];
      const newOtherEmails = candidate.emails.filter((e) => e !== existingContact.email);
      const updates: Record<string, unknown> = {};

      if (newOtherEmails.length > 0) {
        const current = db.select({ other_emails: contacts.other_emails }).from(contacts).where(eq(contacts.id, existingContact.id)).get();
        const currentOthers: string[] = (current?.other_emails as string[] | null) ?? [];
        updates.other_emails = [...new Set([...currentOthers, ...newOtherEmails])];
      }

      if (!existingContact.phone && candidate.phone) updates.phone = candidate.phone;

      if (Object.keys(updates).length > 0) {
        db.update(contacts).set(updates).where(eq(contacts.id, existingContact.id)).run();
      }
      skipped++;
      continue;
    }

    try {
      db.insert(contacts).values({
        id: crypto.randomUUID(),
        user_id: userId,
        email: candidate.primaryEmail,
        name: candidate.name,
        company: candidate.company,
        title: candidate.title,
        phone: candidate.phone,
        linkedin_url: "",
        warmth_score: 0,
        other_emails: candidate.otherEmails as any,
      }).run();
      imported++;
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint")) { skipped++; }
      else { errors.push(`Failed to import ${candidate.primaryEmail}: ${err.message}`); }
    }
  }

  console.log(`[people-sync] Done. Total: ${total}, Imported: ${imported}, Skipped: ${skipped}, No email: ${noEmail}, Phone-only: ${phoneOnly}`);
  return { imported, skipped, noEmail, phoneOnly, total, errors };
}
