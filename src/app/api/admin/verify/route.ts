import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ isAdmin: false });
  }

  const token = req.cookies.get('admin_token')?.value;
  return NextResponse.json({ isAdmin: token === secret });
}
