import { google } from "googleapis";
import { getDb } from "@/lib/db";
import { connectedAccounts, contacts, deletedContacts, interactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getValidAccessToken } from "@/services/auth.service";
import { createInteraction } from "@/services/interactions.service";
import { isNonIndividualEmail } from "@/lib/email-filter";

export async function syncGmail(userId: string, accountId: string): Promise<{ syncedCount: number }> {
  const accessToken = await getValidAccessToken(accountId);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const db = getDb();
  const account = db.select({ account_email: connectedAccounts.account_email })
    .from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).get();

  const userEmail = account?.account_email ?? "";
  const threeYearsAgo = Math.floor(Date.now() / 1000) - 3 * 365 * 24 * 60 * 60;

  const allContacts = db.select({ id: contacts.id, email: contacts.email })
    .from(contacts).where(eq(contacts.user_id, userId)).all();

  const contactEmails = new Set(allContacts.map((c) => c.email.toLowerCase()));

  const deletedRows = db.select({ email: deletedContacts.email })
    .from(deletedContacts).where(eq(deletedContacts.user_id, userId)).all();
  const deletedEmailSet = new Set(deletedRows.map((r) => r.email));

  const latestInteractions = db.select({ contact_id: interactions.contact_id, occurred_at: interactions.occurred_at })
    .from(interactions).where(eq(interactions.user_id, userId)).orderBy(desc(interactions.occurred_at)).all();

  const contactLastInteraction = new Map<string, number>();
  for (const row of latestInteractions) {
    if (!contactLastInteraction.has(row.contact_id)) {
      contactLastInteraction.set(row.contact_id, Math.floor(new Date(row.occurred_at).getTime() / 1000));
    }
  }

  const emailAfterMap = new Map<string, number>();
  let globalAfter = Math.floor(Date.now() / 1000);
  for (const contact of allContacts) {
    const lastEpoch = contactLastInteraction.get(contact.id);
    const afterEpoch = lastEpoch ?? threeYearsAgo;
    emailAfterMap.set(contact.email.toLowerCase(), afterEpoch);
    if (afterEpoch < globalAfter) globalAfter = afterEpoch;
  }

  if (allContacts.length === 0) return { syncedCount: 0 };

  let query = "-in:trash -category:promotions -category:social -category:updates -category:forums";
  query += ` after:${globalAfter}`;

  const messageIds: string[] = [];
  let nextPageToken: string | undefined;
  do {
    const listResponse = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 500, pageToken: nextPageToken });
    for (const m of listResponse.data.messages ?? []) {
      if (m.id) messageIds.push(m.id);
    }
    nextPageToken = listResponse.data.nextPageToken ?? undefined;
  } while (nextPageToken);

  let syncedCount = 0;

  const emailToContactId = new Map<string, string>();
  for (const contact of allContacts) {
    emailToContactId.set(contact.email.toLowerCase(), contact.id);
  }

  const parseEmail = (header: string): string => {
    const match = header.match(/<(.+?)>/);
    return match ? match[1].toLowerCase() : header.toLowerCase().trim();
  };

  for (const messageId of messageIds) {
    const msg = await gmail.users.messages.get({ userId: "me", id: messageId, format: "metadata", metadataHeaders: ["Subject", "From", "To", "Date"] });

    const headers = msg.data.payload?.headers ?? [];
    const labelIds = (msg.data.labelIds as string[]) ?? [];

    const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const subject = getHeader("Subject");
    const from = getHeader("From");
    const to = getHeader("To");
    const dateStr = getHeader("Date");
    const snippet = msg.data.snippet ?? "";

    const fromEmail = parseEmail(from);
    const toEmail = parseEmail(to);
    const isSent = fromEmail === userEmail.toLowerCase();
    const otherEmail = isSent ? toEmail : fromEmail;
    const type = isSent ? "email_sent" : "email_received";

    if (isNonIndividualEmail(otherEmail, labelIds)) continue;
    if (deletedEmailSet.has(otherEmail)) continue;

    const contactId = emailToContactId.get(otherEmail);
    if (!contactId) continue;

    const contactAfter = emailAfterMap.get(otherEmail);
    if (contactAfter && dateStr) {
      const msgEpoch = Math.floor(new Date(dateStr).getTime() / 1000);
      if (msgEpoch < contactAfter) continue;
    }

    const result = await createInteraction({
      user_id: userId, contact_id: contactId, type, source_id: messageId,
      subject, snippet, body_text: "", ai_summary: "",
      occurred_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    });

    if (result) syncedCount++;
  }

  return { syncedCount };
}
