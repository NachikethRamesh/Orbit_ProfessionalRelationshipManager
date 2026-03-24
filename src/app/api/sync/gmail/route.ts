/**
 * Gmail Sync Route — POST /api/sync/gmail
 *
 * Triggers a Gmail sync for all of the authenticated user's connected
 * Google accounts. Creates interaction records for each email found.
 *
 * Deduplication is handled via the Gmail message ID (source_id),
 * so calling this multiple times is safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { syncGmail } from '@/services/gmail.service';
import { getDb } from '@/lib/db';
import { connectedAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateAutoReminders } from '@/services/auto-reminders.service';

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Fetch all connected Google accounts for this user */
    const db = getDb();
    const accounts = db
      .select({ id: connectedAccounts.id, account_email: connectedAccounts.account_email })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.user_id, user!.id), eq(connectedAccounts.provider, 'google')))
      .all();

    let totalSynced = 0;

    /* Sync Gmail for each connected account */
    for (const account of accounts) {
      try {
        const result = await syncGmail(user!.id, account.id);
        totalSynced += result.syncedCount;
      } catch (err) {
        console.error(`[POST /api/sync/gmail] Failed for ${account.account_email}:`, err);
      }
    }

    /* Run auto-reminders after sync (auto-dismiss stale, create new) */
    try {
      await generateAutoReminders(user!.id);
    } catch (err) {
      console.error('[POST /api/sync/gmail] Auto-reminders failed:', err);
    }

    return NextResponse.json({
      success: true,
      syncedCount: totalSynced,
    });
  } catch (err) {
    console.error('[POST /api/sync/gmail] Error:', err);
    return NextResponse.json(
      { error: 'Failed to sync Gmail' },
      { status: 500 }
    );
  }
}
