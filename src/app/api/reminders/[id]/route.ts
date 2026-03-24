/**
 * Single Reminder Route — PATCH /api/reminders/[id]
 *
 * Updates a specific reminder's status or reschedules it.
 *
 * Common operations:
 *  - Mark as "completed" when the user has taken the action.
 *  - Mark as "dismissed" when the user wants to ignore it.
 *  - Update remind_at to reschedule the reminder to a later time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { updateReminder } from '@/services/reminders.service';

/** Route params containing the reminder ID from the URL */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/reminders/[id]
 *
 * Updates a reminder's status or remind_at time.
 *
 * Request body (all optional, at least one required):
 *  - status: "pending" | "completed" | "dismissed"
 *  - remind_at: ISO timestamp to reschedule the reminder.
 *
 * @returns The updated reminder object.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the reminder ID from the URL */
    const { id } = await params;

    /* Parse the update fields from the request body */
    const body = await req.json();

    /* Build the update object from allowed fields only */
    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.remind_at) updates.remind_at = body.remind_at;

    /* Apply the update */
    const reminder = await updateReminder(user!.id, id, updates);

    return NextResponse.json(reminder);
  } catch (err) {
    console.error('[PATCH /api/reminders/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update reminder' },
      { status: 500 }
    );
  }
}
