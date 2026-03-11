import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS canvas_elements (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        z_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    return NextResponse.json({ success: true, message: 'canvas_elements table created' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Database initialization failed' },
      { status: 500 }
    );
  }
}
