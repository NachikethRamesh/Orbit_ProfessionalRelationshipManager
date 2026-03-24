/**
 * Dashboard Route — GET /api/dashboard
 *
 * Returns all data needed for the main dashboard view in a single
 * API call. This consolidates six database queries into one endpoint
 * to avoid waterfall fetches from the frontend.
 *
 * Dashboard data includes:
 *  - Total contact count
 *  - 5 most recent interactions (across all contacts)
 *  - Top 10 pending AI suggestions
 *  - Upcoming reminders (next 7 days)
 *  - Decaying contacts (warmth < 30, needing attention)
 *  - Upcoming meetings (next 48 hours)
 *
 * All queries run in parallel via Promise.all for performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { getDashboardData } from '@/services/dashboard.service';

/**
 * GET /api/dashboard
 *
 * Fetches aggregated dashboard data for the authenticated user.
 *
 * @returns A DashboardData object containing all dashboard sections.
 */
export async function GET(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Fetch all dashboard data in parallel */
    const data = await getDashboardData(user!.id);

    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/dashboard] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
