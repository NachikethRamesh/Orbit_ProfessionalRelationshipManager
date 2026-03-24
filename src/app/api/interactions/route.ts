/**
 * Interactions Route — GET /api/interactions
 *
 * Returns interactions for a specific contact. The contact_id is
 * required as a query parameter because interactions are always
 * viewed in the context of a single contact.
 *
 * Results are ordered newest-first and limited to 50 by default.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { getInteractions } from '@/services/interactions.service';

/**
 * GET /api/interactions?contact_id=...
 *
 * Lists interactions for a specific contact, ordered newest first.
 *
 * Query params:
 *  - contact_id (required): The contact whose interactions to fetch.
 *
 * @returns An array of interaction objects.
 */
export async function GET(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the required contact_id from the query string */
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contact_id');

    /* Validate that contact_id is provided */
    if (!contactId) {
      return NextResponse.json(
        { error: 'Missing required "contact_id" query parameter' },
        { status: 400 }
      );
    }

    /* Fetch interactions for this contact, scoped to the authenticated user */
    const interactions = await getInteractions(user!.id, contactId);

    return NextResponse.json(interactions);
  } catch (err) {
    console.error('[GET /api/interactions] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch interactions' },
      { status: 500 }
    );
  }
}
