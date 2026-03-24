import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { deleteContacts } from '@/services/contacts.service';

/**
 * POST /api/contacts/bulk-delete
 *
 * Deletes multiple contacts by ID and adds their emails to the exclusion list.
 * Body: { ids: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const { ids } = (await req.json()) as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 }
      );
    }

    const deleted = await deleteContacts(user!.id, ids);

    return NextResponse.json({ deleted });
  } catch (err) {
    console.error('[POST /api/contacts/bulk-delete] Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete contacts' },
      { status: 500 }
    );
  }
}
