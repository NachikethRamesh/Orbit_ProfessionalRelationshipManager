/**
 * Current User Route — GET /api/auth/me
 *
 * Returns the authenticated user's profile data and their connected accounts.
 * Both queries run in parallel to minimize latency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { getDb } from '@/lib/db';
import { users, connectedAccounts } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Run both queries — synchronous with better-sqlite3 via Drizzle */
    const db = getDb();
    const profile = db
      .select({ id: users.id, email: users.email, name: users.name, created_at: users.created_at })
      .from(users)
      .where(eq(users.id, user!.id))
      .get();

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const connectedAccountRows = db
      .select({ id: connectedAccounts.id, provider: connectedAccounts.provider, account_email: connectedAccounts.account_email, connected_at: connectedAccounts.connected_at })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.user_id, user!.id))
      .orderBy(asc(connectedAccounts.connected_at))
      .all();
    const googleAccounts = connectedAccountRows.filter(a => a.provider === 'google');

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        google_connected: googleAccounts.length > 0,
        connected_accounts: connectedAccountRows,
        created_at: profile.created_at,
      },
    });
  } catch (err) {
    console.error('[GET /api/auth/me] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
