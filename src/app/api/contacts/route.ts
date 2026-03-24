/**
 * Contacts Collection Route — GET & POST /api/contacts
 *
 * Handles listing contacts with filtering/sorting and creating new contacts.
 *
 * GET: Returns the user's contacts, with optional query parameters:
 *  - search: free-text search across name, email, company
 *  - tag: filter to contacts with a specific tag
 *  - sort_by: column to sort by (default: "name")
 *  - sort_order: "asc" or "desc" (default: "asc")
 *
 * POST: Creates a new contact from the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { listContacts, createContact, deleteAllContacts } from '@/services/contacts.service';

/**
 * GET /api/contacts
 *
 * Lists all contacts for the authenticated user with optional filters.
 * Filters are passed as URL search parameters.
 *
 * @returns An array of contact objects, each with a tags[] array.
 */
export async function GET(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract filter parameters from the query string */
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const starred = searchParams.get('starred') === 'true' ? true : undefined;
    const sort_by = searchParams.get('sort_by') || undefined;
    const sort_order = (searchParams.get('sort_order') as 'asc' | 'desc') || undefined;

    /* Fetch contacts with the applied filters */
    const contacts = await listContacts(user!.id, {
      search,
      tag,
      starred,
      sort_by,
      sort_order,
    });

    return NextResponse.json(contacts);
  } catch (err) {
    console.error('[GET /api/contacts] Error:', err);
    return NextResponse.json(
      { error: 'Failed to list contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts
 *
 * Creates a new contact for the authenticated user.
 * The request body should contain contact fields (name, email, company, etc.).
 *
 * @returns The newly created contact object.
 */
export async function POST(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Parse the contact data from the request body */
    const body = await req.json();

    /* Create the contact in the database */
    const contact = await createContact(user!.id, body);

    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    console.error('[POST /api/contacts] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts
 *
 * Deletes ALL contacts for the authenticated user in a single operation.
 *
 * @returns { deleted: number } — how many contacts were removed.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const deleted = await deleteAllContacts(user!.id);

    return NextResponse.json({ deleted });
  } catch (err) {
    console.error('[DELETE /api/contacts] Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete contacts' },
      { status: 500 }
    );
  }
}
