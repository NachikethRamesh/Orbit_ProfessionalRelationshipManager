/**
 * Suggestions Collection Route — GET /api/suggestions
 *
 * Returns AI-generated suggestions for the authenticated user.
 * Supports optional filtering by status (pending, accepted, dismissed, snoozed)
 * and by contact_id to show suggestions for a specific contact.
 *
 * Each suggestion includes joined contact data (name, email) so
 * the frontend can display context without additional requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { listSuggestions } from '@/services/suggestions.service';

/**
 * GET /api/suggestions
 *
 * Lists AI-generated suggestions for the authenticated user.
 *
 * Query params (all optional):
 *  - status: Filter by suggestion status ("pending", "accepted", etc.)
 *  - contact_id: Filter to suggestions for a specific contact.
 *
 * @returns An array of suggestion objects with contact info.
 */
export async function GET(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract optional filter parameters from the query string */
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const contactId = searchParams.get('contact_id') || undefined;

    /* Fetch suggestions with the applied filters */
    const suggestions = await listSuggestions(user!.id, status, contactId);

    return NextResponse.json(suggestions);
  } catch (err) {
    console.error('[GET /api/suggestions] Error:', err);
    return NextResponse.json(
      { error: 'Failed to list suggestions' },
      { status: 500 }
    );
  }
}
