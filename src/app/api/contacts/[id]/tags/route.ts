/**
 * Contact Tags Route — POST /api/contacts/[id]/tags
 *
 * Adds a tag to a specific contact. Tags are stored in the contact_tags
 * join table and support filtering contacts by category (e.g., "investor",
 * "friend", "client").
 *
 * Duplicate tags are silently ignored by the database unique constraint,
 * so calling this twice with the same tag is safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { addTag } from '@/services/contacts.service';

/** Route params containing the contact ID from the URL */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/contacts/[id]/tags
 *
 * Adds a tag to the specified contact.
 *
 * Request body: { tag: string }
 *
 * @returns A 201 response with a success message.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the contact ID from the URL */
    const { id } = await params;

    /* Parse the tag from the request body */
    const body = await req.json();
    const { tag } = body;

    /* Validate that a tag was provided */
    if (!tag || typeof tag !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "tag" field in request body' },
        { status: 400 }
      );
    }

    /* Add the tag to the contact (duplicates are silently ignored) */
    await addTag(user!.id, id, tag);

    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/contacts/[id]/tags] Error:', err);
    return NextResponse.json(
      { error: 'Failed to add tag' },
      { status: 500 }
    );
  }
}
