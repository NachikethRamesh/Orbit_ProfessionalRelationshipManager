/**
 * Reminders Collection Route — GET & POST /api/reminders
 *
 * GET: Lists reminders for the authenticated user, optionally
 *      filtered by status (pending, completed, dismissed).
 *      Results include joined contact data and are sorted
 *      by remind_at ascending (soonest first).
 *
 * POST: Creates a new reminder for a contact.
 *       Reminders can be standalone or linked to a suggestion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { listReminders, createReminder } from '@/services/reminders.service';

/**
 * GET /api/reminders
 *
 * Lists all reminders for the authenticated user.
 *
 * Query params (optional):
 *  - status: Filter by reminder status ("pending", "completed", "dismissed").
 *
 * @returns An array of reminder objects with contact info.
 */
export async function GET(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract optional status filter from the query string */
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    /* Fetch reminders with the applied filter */
    const reminders = await listReminders(user!.id, status);

    return NextResponse.json(reminders);
  } catch (err) {
    console.error('[GET /api/reminders] Error:', err);
    return NextResponse.json(
      { error: 'Failed to list reminders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders
 *
 * Creates a new reminder for a contact.
 *
 * Request body:
 *  - contact_id (required): The contact this reminder is about.
 *  - title (required): A short description of what to do.
 *  - remind_at (required): ISO timestamp for when to remind.
 *  - suggestion_id (optional): Link to the suggestion that triggered this.
 *
 * @returns The newly created reminder object.
 */
export async function POST(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Parse the reminder data from the request body */
    const body = await req.json();

    /* Create the reminder with the authenticated user's ID */
    const reminder = await createReminder({
      user_id: user!.id,
      contact_id: body.contact_id,
      suggestion_id: body.suggestion_id || null,
      title: body.title,
      remind_at: body.remind_at,
      status: 'pending',
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (err) {
    console.error('[POST /api/reminders] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create reminder' },
      { status: 500 }
    );
  }
}
