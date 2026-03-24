/**
 * Cron Jobs — Local Background Tasks
 *
 * Replaces Trigger.dev scheduled tasks with node-cron for local execution.
 * Single-user ("local-user"), no multi-user iteration needed.
 *
 * Jobs:
 *   - Daily 6:00 AM  — Sync (Google Contacts + Gmail + Calendar + auto-reminders)
 *   - Daily midnight  — Warmth decay + check-in suggestions + auto-reminders
 *   - Every 30 min    — AI analysis (summarize interactions + generate suggestions)
 *   - Daily 1:00 AM   — Auto-reminders standalone pass
 */

import cron from "node-cron";

const LOCAL_USER_ID = "local-user";

/** Start all cron jobs (call once from the CLI entry point) */
export function startCronJobs() {
  console.log("[cron] Starting background jobs...");

  /* ── Daily 6:00 AM — Full sync ── */
  cron.schedule("0 6 * * *", async () => {
    console.log("[cron:sync] Starting daily sync...");
    try {
      const { getDb } = await import("@/lib/db");
      const { connectedAccounts } = await import("@/lib/db/schema");
      const { isNotNull } = await import("drizzle-orm");
      const { importGoogleContacts } = await import("@/services/people.service");
      const { syncGmail } = await import("@/services/gmail.service");
      const { syncCalendar } = await import("@/services/calendar.service");
      const { generateAutoReminders } = await import("@/services/auto-reminders.service");

      const db = getDb();
      const accounts = db.select()
        .from(connectedAccounts)
        .where(isNotNull(connectedAccounts.google_refresh_token))
        .all();

      if (accounts.length === 0) {
        console.log("[cron:sync] No connected accounts. Skipping.");
        return;
      }

      for (const account of accounts) {
        try {
          const contactsResult = await importGoogleContacts(account.user_id, account.id);
          console.log(`[cron:sync] Contacts for ${account.account_email}: ${contactsResult.imported} imported`);

          const gmailResult = await syncGmail(account.user_id, account.id);
          console.log(`[cron:sync] Gmail for ${account.account_email}: ${gmailResult.syncedCount} new emails`);

          const calendarResult = await syncCalendar(account.user_id, account.id);
          console.log(`[cron:sync] Calendar for ${account.account_email}: ${calendarResult.syncedCount} new meetings`);
        } catch (err) {
          console.error(`[cron:sync] Failed for ${account.account_email}:`, err instanceof Error ? err.message : err);
        }
      }

      /* Auto-reminders after sync */
      try {
        const result = await generateAutoReminders(LOCAL_USER_ID);
        console.log(`[cron:sync] Auto-reminders: created ${result.created}, dismissed ${result.dismissed}`);
      } catch (err) {
        console.error("[cron:sync] Auto-reminders failed:", err instanceof Error ? err.message : err);
      }

      console.log("[cron:sync] Sync cycle complete.");
    } catch (err) {
      console.error("[cron:sync] Fatal error:", err instanceof Error ? err.message : err);
    }
  });

  /* ── Daily midnight — Warmth decay ── */
  cron.schedule("0 0 * * *", async () => {
    console.log("[cron:warmth] Starting warmth decay...");
    try {
      const { getDb } = await import("@/lib/db");
      const { contacts } = await import("@/lib/db/schema");
      const { eq, lt, and } = await import("drizzle-orm");
      const { recalculateAllWarmth } = await import("@/services/warmth.service");
      const { createSuggestion, getPendingSuggestionTypes } = await import("@/services/suggestions.service");
      const { generateAutoReminders } = await import("@/services/auto-reminders.service");

      /* Phase 1: Recalculate warmth */
      await recalculateAllWarmth(LOCAL_USER_ID);
      console.log("[cron:warmth] Warmth scores recalculated.");

      /* Phase 2: Check-in suggestions for cold contacts */
      const db = getDb();
      const coldContacts = db.select({ id: contacts.id, name: contacts.name, warmth_score: contacts.warmth_score })
        .from(contacts)
        .where(and(eq(contacts.user_id, LOCAL_USER_ID), lt(contacts.warmth_score, 30)))
        .all();

      let checkInsCreated = 0;
      for (const contact of coldContacts) {
        const pendingTypes = await getPendingSuggestionTypes(LOCAL_USER_ID, contact.id);
        if (pendingTypes.includes("check_in")) continue;

        const created = await createSuggestion({
          user_id: LOCAL_USER_ID,
          contact_id: contact.id,
          type: "check_in",
          title: `Check in with ${contact.name}`,
          body: `Your warmth score with ${contact.name} has dropped to ${contact.warmth_score}. Consider reaching out to maintain the relationship.`,
          priority: (contact.warmth_score ?? 0) < 15 ? 4 : 3,
          status: "pending",
        });
        if (created) checkInsCreated++;
      }
      console.log(`[cron:warmth] Created ${checkInsCreated} check-in suggestions (${coldContacts.length} cold contacts).`);

      /* Phase 3: Auto-reminders */
      const reminderResult = await generateAutoReminders(LOCAL_USER_ID);
      console.log(`[cron:warmth] Auto-reminders: created ${reminderResult.created}, dismissed ${reminderResult.dismissed}`);

      console.log("[cron:warmth] Warmth decay cycle complete.");
    } catch (err) {
      console.error("[cron:warmth] Fatal error:", err instanceof Error ? err.message : err);
    }
  });

  /* ── Every 30 min (offset) — AI analysis ── */
  cron.schedule("5,35 * * * *", async () => {
    console.log("[cron:ai] Starting AI analysis...");
    try {
      const pLimit = (await import("p-limit")).default;
      const { getDb } = await import("@/lib/db");
      const { interactions, contacts } = await import("@/lib/db/schema");
      const { eq, and, gte, desc } = await import("drizzle-orm");
      const { summarizeInteraction } = await import("@/services/summarizer.service");
      const { generateActionItems } = await import("@/services/action-items.service");
      const { createSuggestion } = await import("@/services/suggestions.service");

      const db = getDb();

      /* Part A: Summarize unsummarized interactions */
      const unsummarized = db.select().from(interactions)
        .where(and(eq(interactions.user_id, LOCAL_USER_ID), eq(interactions.ai_summary, "")))
        .orderBy(desc(interactions.occurred_at))
        .limit(50)
        .all();

      const summarizeLimit = pLimit(10);
      const summarizeResults = await Promise.all(
        unsummarized.map((interaction) =>
          summarizeLimit(async () => {
            try {
              const summary = await summarizeInteraction({
                subject: interaction.subject ?? "",
                snippet: interaction.snippet ?? "",
                body_text: interaction.body_text ?? "",
                type: interaction.type,
              });
              if (summary) {
                db.update(interactions).set({ ai_summary: summary }).where(eq(interactions.id, interaction.id)).run();
                return true;
              }
              return false;
            } catch (err) {
              console.error(`[cron:ai] Failed to summarize ${interaction.id}:`, err instanceof Error ? err.message : err);
              return false;
            }
          })
        )
      );
      console.log(`[cron:ai] Summarized ${summarizeResults.filter(Boolean).length} interactions.`);

      /* Part B: Suggestions for recently active contacts */
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentInteractions = db.select({ contact_id: interactions.contact_id })
        .from(interactions)
        .where(and(eq(interactions.user_id, LOCAL_USER_ID), gte(interactions.occurred_at, twentyFourHoursAgo)))
        .all();

      const contactIds = [...new Set(recentInteractions.map((i) => i.contact_id))];

      const actionLimit = pLimit(5);
      const suggestionResults = await Promise.all(
        contactIds.map((contactId) =>
          actionLimit(async () => {
            try {
              const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
              if (!contact) return 0;

              const contactInts = db.select().from(interactions)
                .where(and(eq(interactions.contact_id, contactId), eq(interactions.user_id, LOCAL_USER_ID)))
                .orderBy(desc(interactions.occurred_at))
                .limit(10)
                .all();

              const actionItems = await generateActionItems(contact as any, contactInts as any);
              let count = 0;
              for (const item of actionItems) {
                const created = await createSuggestion({
                  user_id: LOCAL_USER_ID,
                  contact_id: contactId,
                  type: item.type,
                  title: item.title,
                  body: item.body,
                  priority: item.priority,
                  status: "pending",
                });
                if (created) count++;
              }
              return count;
            } catch (err) {
              console.error(`[cron:ai] Suggestions failed for contact ${contactId}:`, err instanceof Error ? err.message : err);
              return 0;
            }
          })
        )
      );
      console.log(`[cron:ai] Created ${suggestionResults.reduce((s, n) => s + n, 0)} suggestions.`);
      console.log("[cron:ai] AI analysis cycle complete.");
    } catch (err) {
      console.error("[cron:ai] Fatal error:", err instanceof Error ? err.message : err);
    }
  });

  /* ── Daily 1 AM — Auto-reminders standalone ── */
  cron.schedule("0 1 * * *", async () => {
    console.log("[cron:reminders] Starting auto-reminders...");
    try {
      const { generateAutoReminders } = await import("@/services/auto-reminders.service");
      const result = await generateAutoReminders(LOCAL_USER_ID);
      console.log(`[cron:reminders] Created ${result.created}, dismissed ${result.dismissed}.`);
    } catch (err) {
      console.error("[cron:reminders] Fatal error:", err instanceof Error ? err.message : err);
    }
  });

  console.log("[cron] All jobs scheduled.");
}
