/**
 * Single Tag Route — DELETE /api/contacts/[id]/tags/[tag]
 *
 * Removes a specific tag from a contact. The tag to remove is
 * specified in the URL path (e.g., /api/contacts/abc/tags/investor).
 *
 * If the tag doesn't exist on the contact, this is a no-op (no error).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { removeTag } from '@/services/contacts.service';

/** Route params containing the contact ID and tag from the URL */
type RouteParams = { params: Promise<{ id: string; tag: string }> };

/**
 * DELETE /api/contacts/[id]/tags/[tag]
 *
 * Removes the specified tag from the contact.
 *
 * @returns A 200 response with a success message.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the contact ID and tag name from the URL parameters */
    const { id, tag } = await params;

    /* Decode the tag in case it contains URL-encoded characters */
    const decodedTag = decodeURIComponent(tag);

    /* Remove the tag from the contact */
    await removeTag(user!.id, id, decodedTag);

    return NextResponse.json({ success: true, removedTag: decodedTag });
  } catch (err) {
    console.error('[DELETE /api/contacts/[id]/tags/[tag]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to remove tag' },
      { status: 500 }
    );
  }
}
