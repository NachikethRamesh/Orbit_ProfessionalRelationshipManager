import { NextRequest, NextResponse } from 'next/server';

const LOCAL_USER = { id: 'local-user', email: 'local@orbit.local' };

export async function getAuthUser(_req: NextRequest) {
  return { user: LOCAL_USER, error: null };
}
