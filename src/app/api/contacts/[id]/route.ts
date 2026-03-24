/**
 * Single Contact Route — GET, PATCH, DELETE /api/contacts/[id]
 *
 * Handles operations on a single contact identified by its UUID.
 *
 * GET: Retrieves a contact with its tags.
 * PATCH: Updates specific fields on a contact.
 * DELETE: Permanently removes a contact and all associated data.
 *
 * All operations verify that the contact belongs to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import {
  getContact,
  updateContact,
  deleteContact,
} from '@/services/contacts.service';

/** Route params containing the contact ID from the URL */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]
 *
 * Retrieves a single contact by ID, including its tags array.
 * Returns 404 if the contact doesn't exist or doesn't belong to the user.
 *
 * @returns The contact object with tags.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the contact ID from the URL parameters */
    const { id } = await params;

    /* Fetch the contact, scoped to the authenticated user */
    const contact = await getContact(user!.id, id);

    /* Return 404 if the contact wasn't found or doesn't belong to this user */
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (err) {
    console.error('[GET /api/contacts/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contacts/[id]
 *
 * Partially updates a contact's fields. Only the fields present in
 * the request body will be changed; others remain untouched.
 *
 * @returns The updated contact object.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the contact ID and the update payload */
    const { id } = await params;
    const body = await req.json();

    /* Apply the partial update */
    const contact = await updateContact(user!.id, id, body);

    return NextResponse.json(contact);
  } catch (err) {
    console.error('[PATCH /api/contacts/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[id]
 *
 * Permanently deletes a contact and all associated data (tags, interactions,
 * suggestions, reminders) via database CASCADE rules.
 *
 * @returns A 204 No Content response on success.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the contact ID from the URL parameters */
    const { id } = await params;

    /* Delete the contact (cascades to related records) */
    await deleteContact(user!.id, id);

    /* Return 204 No Content — the resource no longer exists */
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/contacts/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}
