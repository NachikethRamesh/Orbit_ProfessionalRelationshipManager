/**
 * Calendar Sync Route — POST /api/sync/calendar
 *
 * Triggers a Google Calendar sync for all of the authenticated user's
 * connected Google accounts. Creates meeting-type interaction records.
 *
 * Supports incremental mode via Google's sync tokens, so subsequent
 * calls only fetch events that changed since the last sync.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { syncCalendar } from '@/services/calendar.service';
import { getDb } from '@/lib/db';
import { connectedAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    /* Sync Calendar for each connected account */
    for (const account of accounts) {
      try {
        const result = await syncCalendar(user!.id, account.id);
        totalSynced += result.syncedCount;
      } catch (err) {
        console.error(`[POST /api/sync/calendar] Failed for ${account.account_email}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: totalSynced,
    });
  } catch (err) {
    console.error('[POST /api/sync/calendar] Error:', err);
    return NextResponse.json(
      { error: 'Failed to sync calendar' },
      { status: 500 }
    );
  }
}
