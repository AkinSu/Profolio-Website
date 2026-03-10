import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if the request has a valid admin token.
 * Returns null if authorized, or a 401 response if not.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // If no secret is configured, block all writes for safety
    return NextResponse.json({ error: 'Admin not configured' }, { status: 401 });
  }

  const token = req.cookies.get('admin_token')?.value;
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // Authorized
}
