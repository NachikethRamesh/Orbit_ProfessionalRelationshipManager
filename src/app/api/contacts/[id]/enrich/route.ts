/**
 * Contact Enrichment Route — POST /api/contacts/[id]/enrich
 *
 * Triggers enrichment of a contact using the Exa API. This searches
 * the web for publicly available information about the contact
 * (based on their name and company) and stores the results in the
 * contact's exa_data JSONB field.
 *
 * Enrichment data is used in meeting briefs and contact profile views
 * to provide background context on the person.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { enrichContact } from '@/services/exa.service';

/** Route params containing the contact ID from the URL */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/contacts/[id]/enrich
 *
 * Enriches the specified contact with public web data via the Exa API.
 *
 * @returns The enrichment data object from Exa.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Extract the contact ID from the URL */
    const { id } = await params;

    /* Run the enrichment process (search Exa + store results) */
    const enrichmentData = await enrichContact(user!.id, id);

    return NextResponse.json({
      success: true,
      data: enrichmentData,
    });
  } catch (err) {
    console.error('[POST /api/contacts/[id]/enrich] Error:', err);
    return NextResponse.json(
      { error: 'Failed to enrich contact' },
      { status: 500 }
    );
  }
}
