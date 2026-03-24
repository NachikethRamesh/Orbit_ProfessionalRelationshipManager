import { google } from "googleapis";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken } from "@/services/auth.service";
import { resolveContact } from "@/services/contact-resolver.service";
import { createInteraction } from "@/services/interactions.service";

export async function syncCalendar(userId: string, accountId: string): Promise<{ syncedCount: number }> {
  const accessToken = await getValidAccessToken(accountId);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const db = getDb();
  const account = db.select({ account_email: connectedAccounts.account_email, calendar_sync_cursor: connectedAccounts.calendar_sync_cursor })
    .from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).get();

  const userEmail = (account?.account_email ?? "").toLowerCase();

  let listParams: Record<string, unknown> = {
    calendarId: "primary", singleEvents: true, orderBy: "startTime", maxResults: 250,
  };

  if (account?.calendar_sync_cursor) {
    listParams.syncToken = account.calendar_sync_cursor;
  } else {
    const now = new Date();
    listParams.timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    listParams.timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  let syncedCount = 0;
  let nextSyncToken: string | undefined;

  try {
    const response = await calendar.events.list(listParams as any);
    const events = (response as any).data.items ?? [];
    nextSyncToken = (response as any).data.nextSyncToken ?? undefined;

    for (const event of events) {
      if (event.status === "cancelled") continue;

      const title = event.summary ?? "Untitled Meeting";
      const startTime = event.start?.dateTime ?? event.start?.date ?? new Date().toISOString();
      const eventId = event.id ?? "";
      const attendees = event.attendees ?? [];

      const externalAttendees = attendees.filter((a: any) => a.email && a.email.toLowerCase() !== userEmail);

      for (const attendee of externalAttendees) {
        if (!attendee.email) continue;

        const contactId = await resolveContact(userId, attendee.email.toLowerCase(), attendee.displayName ?? "");
        const sourceId = `cal:${eventId}:${attendee.email.toLowerCase()}`;

        const result = await createInteraction({
          user_id: userId, contact_id: contactId, type: "meeting", source_id: sourceId,
          subject: title, snippet: `Meeting with ${attendee.displayName ?? attendee.email}`,
          body_text: event.description ?? "", ai_summary: "",
          occurred_at: new Date(startTime).toISOString(),
        });

        if (result) syncedCount++;
      }
    }
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 410) {
      db.update(connectedAccounts).set({ calendar_sync_cursor: null }).where(eq(connectedAccounts.id, accountId)).run();
      throw new Error("Calendar sync token expired. Cleared cursor — retry will do a full sync.");
    }
    throw err;
  }

  if (nextSyncToken) {
    db.update(connectedAccounts).set({ calendar_sync_cursor: nextSyncToken }).where(eq(connectedAccounts.id, accountId)).run();
  }

  return { syncedCount };
}
