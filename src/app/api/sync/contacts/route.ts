/**
 * Build PRM Route — POST /api/sync/contacts
 *
 * Full PRM build pipeline:
 *  1. Import Google Contacts into PRM (deduped, grouped, company email prioritized)
 *  2. Sync Gmail interactions for all connected accounts
 *  3. Enrich all new contacts via Exa + AI search
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { importGoogleContacts } from "@/services/people.service";
import { syncGmail } from "@/services/gmail.service";
import { generateAutoReminders } from "@/services/auto-reminders.service";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const db = getDb();
    const accounts = db
      .select({ id: connectedAccounts.id, account_email: connectedAccounts.account_email })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.user_id, user!.id), eq(connectedAccounts.provider, "google")))
      .all();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: "No Google accounts connected. Connect an account first." },
        { status: 400 }
      );
    }

    /* ── Phase 1: Import contacts (parallel across accounts) ── */
    let totalImported = 0;
    let totalSkipped = 0;
    let totalNoEmail = 0;
    let totalPhoneOnly = 0;
    let totalFromAPI = 0;
    const allErrors: string[] = [];

    const importResults = await Promise.all(
      accounts.map(async (account) => {
        try {
          return { result: await importGoogleContacts(user!.id, account.id), error: null };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { result: null, error: `Account ${account.account_email}: ${msg}` };
        }
      })
    );

    for (const { result, error } of importResults) {
      if (result) {
        totalImported += result.imported;
        totalSkipped += result.skipped;
        totalNoEmail += result.noEmail;
        totalPhoneOnly += result.phoneOnly;
        totalFromAPI += result.total;
        allErrors.push(...result.errors);
      }
      if (error) allErrors.push(error);
    }

    /* ── Phase 2: Sync Gmail interactions (parallel across accounts) ── */
    let totalSynced = 0;

    const syncResults = await Promise.all(
      accounts.map(async (account) => {
        try {
          return await syncGmail(user!.id, account.id);
        } catch (err) {
          console.error(`[build-prm] Gmail sync failed for ${account.account_email}:`, err);
          return null;
        }
      })
    );

    for (const result of syncResults) {
      if (result) totalSynced += result.syncedCount;
    }

    /* ── Phase 3: Auto-reminders ── */
    try {
      await generateAutoReminders(user!.id);
    } catch (err) {
      console.error("[build-prm] Auto-reminders failed:", err);
    }

    /* Build summary message */
    const parts = [`Imported ${totalImported} contacts.`];
    if (totalSynced > 0) parts.push(`Synced ${totalSynced} emails.`);
    if (totalSkipped > 0) parts.push(`${totalSkipped} already existed.`);
    if (allErrors.length > 0) parts.push(`Errors: ${allErrors.join("; ")}`);
    const message = parts.join(" ");

    return NextResponse.json({
      success: true,
      imported: totalImported,
      skipped: totalSkipped,
      noEmail: totalNoEmail,
      phoneOnly: totalPhoneOnly,
      total: totalFromAPI,
      synced: totalSynced,
      errors: allErrors,
      message,
    });
  } catch (err) {
    console.error("[POST /api/sync/contacts] Error:", err);
    return NextResponse.json(
      { error: "Failed to build PRM" },
      { status: 500 }
    );
  }
}
