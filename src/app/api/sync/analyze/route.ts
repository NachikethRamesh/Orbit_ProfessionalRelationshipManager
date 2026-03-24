/**
 * Full Sync & Analyze Route — POST /api/sync/analyze
 *
 * Runs the complete CRM intelligence pipeline for the authenticated user:
 *
 *  1. Sync Gmail (fetch new emails into interactions)
 *  2. Sync Calendar (fetch new events into interactions)
 *  3. Summarize unsummarized interactions using AI
 *  4. Generate action-item suggestions for contacts with recent activity
 *  5. Recalculate warmth scores for all contacts
 *
 * Each step is wrapped in its own try/catch so a failure in one step
 * doesn't prevent the others from running. The response includes
 * detailed results from each step.
 *
 * This is the main "refresh" action that the user triggers from the
 * dashboard to bring their CRM up to date.
 */

import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { syncGmail } from '@/services/gmail.service';
import { syncCalendar } from '@/services/calendar.service';
import { getUnsummarized, updateSummary } from '@/services/interactions.service';
import { summarizeInteraction } from '@/services/summarizer.service';
import { generateActionItems } from '@/services/action-items.service';
import { createSuggestion } from '@/services/suggestions.service';
import { recalculateAllWarmth } from '@/services/warmth.service';
import { getDb } from '@/lib/db';
import { connectedAccounts, contacts, interactions } from '@/lib/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

/**
 * POST /api/sync/analyze
 *
 * Runs the full sync + analysis pipeline for the authenticated user.
 *
 * Pipeline steps:
 *  1. Gmail sync — fetch new emails
 *  2. Calendar sync — fetch new events
 *  3. Summarize — AI-generate summaries for new interactions
 *  4. Action items — generate suggestions for recently active contacts
 *  5. Warmth — recalculate all contact warmth scores
 *
 * @returns A detailed results object showing what happened in each step.
 */
export async function POST(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const userId = user!.id;

    /* Track results from each pipeline step */
    const results = {
      synced: { gmail: 0, calendar: 0 },
      summarized: 0,
      actionItems: 0,
      warmthUpdated: false,
    };

    // ─── Step 1 & 2: Sync Gmail + Calendar for all connected accounts ──
    // Fetch all Google accounts linked by this user, then sync each one.
    // Individual account failures are caught so other accounts still sync.
    try {
      const db = getDb();
      const accounts = db
        .select({ id: connectedAccounts.id, account_email: connectedAccounts.account_email })
        .from(connectedAccounts)
        .where(and(eq(connectedAccounts.user_id, userId), eq(connectedAccounts.provider, 'google')))
        .all();

      const syncResults = await Promise.all(
        (accounts ?? []).map(async (account) => {
          let gmail = 0;
          let calendar = 0;

          try {
            const gmailResult = await syncGmail(userId, account.id);
            gmail = gmailResult.syncedCount;
          } catch (err) {
            console.error(`[sync/analyze] Gmail sync failed for ${account.account_email}:`, err);
          }

          try {
            const calendarResult = await syncCalendar(userId, account.id);
            calendar = calendarResult.syncedCount;
          } catch (err) {
            console.error(`[sync/analyze] Calendar sync failed for ${account.account_email}:`, err);
          }

          return { gmail, calendar };
        })
      );

      for (const r of syncResults) {
        results.synced.gmail += r.gmail;
        results.synced.calendar += r.calendar;
      }
    } catch (err) {
      console.error('[sync/analyze] Account sync step failed:', err);
    }

    // ─── Step 3: Summarize Unsummarized Interactions ─────────────
    // Find interactions without AI summaries and generate them.
    // Each interaction is summarized independently so one failure
    // doesn't block the rest.
    try {
      const unsummarized = await getUnsummarized(userId);

      const summarizeLimit = pLimit(10);
      const summarizeResults = await Promise.all(
        unsummarized.map((interaction) =>
          summarizeLimit(async () => {
            try {
              const summary = await summarizeInteraction({
                subject: interaction.subject,
                snippet: interaction.snippet,
                body_text: interaction.body_text,
                type: interaction.type,
              });
              await updateSummary(interaction.id, summary);
              return true;
            } catch (err) {
              console.error(
                `[sync/analyze] Failed to summarize interaction ${interaction.id}:`,
                err
              );
              return false;
            }
          })
        )
      );

      results.summarized = summarizeResults.filter(Boolean).length;
    } catch (err) {
      console.error('[sync/analyze] Summarization step failed:', err);
    }

    // ─── Step 4: Generate Action Items for Active Contacts ───────
    // Find contacts with interactions in the last 24 hours, then use
    // AI to generate follow-up suggestions for each.
    try {
      const dbAction = getDb();

      /* Find contacts with recent activity (last 24 hours) */
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const recentInteractions = dbAction
        .select({ contact_id: interactions.contact_id })
        .from(interactions)
        .where(and(eq(interactions.user_id, userId), gte(interactions.occurred_at, twentyFourHoursAgo)))
        .all();

      /* Deduplicate contact IDs — we only need to analyze each contact once */
      const uniqueContactIds = [
        ...new Set(recentInteractions.map((i) => i.contact_id)),
      ];

      /* For each recently active contact, generate action items (parallel, up to 5 concurrent) */
      const actionLimit = pLimit(5);
      const actionResults = await Promise.all(
        uniqueContactIds.map((contactId) =>
          actionLimit(async () => {
            try {
              const contact = dbAction
                .select()
                .from(contacts)
                .where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId)))
                .get();

              if (!contact) return 0;

              const contactInteractions = dbAction
                .select()
                .from(interactions)
                .where(and(eq(interactions.user_id, userId), eq(interactions.contact_id, contactId)))
                .orderBy(desc(interactions.occurred_at))
                .limit(5)
                .all();

              const actionItems = await generateActionItems(
                contact as any,
                contactInteractions as any
              );

              let count = 0;
              for (const item of actionItems) {
                await createSuggestion({
                  user_id: userId,
                  contact_id: contactId,
                  type: item.type,
                  title: item.title,
                  body: item.body,
                  priority: item.priority,
                  status: 'pending',
                });
                count++;
              }
              return count;
            } catch (err) {
              console.error(
                `[sync/analyze] Failed to generate action items for contact ${contactId}:`,
                err
              );
              return 0;
            }
          })
        )
      );

      results.actionItems = actionResults.reduce((sum, n) => sum + n, 0);
    } catch (err) {
      console.error('[sync/analyze] Action items step failed:', err);
    }

    // ─── Step 5: Recalculate Warmth Scores ───────────────────────
    // Update warmth scores for all contacts based on interaction
    // frequency, recency, and type. Scores decay over time.
    try {
      await recalculateAllWarmth(userId);
      results.warmthUpdated = true;
    } catch (err) {
      console.error('[sync/analyze] Warmth recalculation failed:', err);
    }

    /* Return the aggregated results from all pipeline steps */
    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err) {
    /* Catch any top-level unexpected errors */
    console.error('[POST /api/sync/analyze] Error:', err);
    return NextResponse.json(
      { error: 'Failed to run sync and analysis pipeline' },
      { status: 500 }
    );
  }
}
