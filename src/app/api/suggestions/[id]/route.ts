/**
 * Single Suggestion Route — PATCH /api/suggestions/[id]
 *
 * Updates the status of a specific AI suggestion. Supported transitions:
 *  - "accepted": The user will act on this suggestion.
 *  - "dismissed": The user doesn't want this suggestion.
 *  - "snoozed": The user wants to be reminded later (requires remind_at).
 *
 * When a suggestion is snoozed, the service automatically creates
 * a corresponding reminder record linked to the suggestion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { updateSuggestion } from '@/services/suggestions.service';

/** Route params containing the suggestion ID from the URL */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/suggestions/[id]
 *
 * Updates a suggestion's status.
 *
 * Request body:
 *  - status (required): "accepted" | "dismissed" | "snoozed"
 *  - remind_at (optional): ISO timestamp for snooze reminders
 *
 * @returns A success confirmation.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the suggestion ID from the URL */
    const { id } = await params;

    /* Parse the status update from the request body */
    const body = await req.json();
    const { status, remind_at } = body;

    /* Validate that a status was provided */
    if (!status) {
      return NextResponse.json(
        { error: 'Missing required "status" field in request body' },
        { status: 400 }
      );
    }

    /* Update the suggestion (and create a reminder if snoozed) */
    await updateSuggestion(user!.id, id, status, remind_at);

    return NextResponse.json({ success: true, id, status });
  } catch (err) {
    console.error('[PATCH /api/suggestions/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 }
    );
  }
}
