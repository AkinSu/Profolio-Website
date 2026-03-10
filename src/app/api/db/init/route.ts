import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
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
  } catch (error) {
    console.error('DB init error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
