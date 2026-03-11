import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

// GET /api/canvas — return all canvas elements
export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, type, data, z_index, created_at, updated_at
      FROM canvas_elements
      ORDER BY z_index ASC, created_at ASC
    `;
    return NextResponse.json({ elements: rows });
  } catch (error) {
    console.error('GET /api/canvas error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/canvas — create a new element
export async function POST(req: NextRequest) {
  // Read body as text first for size check
  const bodyText = await req.text();

  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, type, data, z_index = 0 } = parsed;

  // Drawings: allow unauthenticated, but enforce 100KB size limit
  if (type === 'drawing') {
    if (bodyText.length > 100_000) {
      return NextResponse.json({ error: 'Drawing payload too large (max 100KB)' }, { status: 413 });
    }
  } else {
    // All other types require admin auth
    const authError = requireAdmin(req);
    if (authError) return authError;
  }

  try {
    if (!id || !type || !data) {
      return NextResponse.json({ error: 'Missing required fields: id, type, data' }, { status: 400 });
    }
    const sql = getDb();
    const rows = await sql`
      INSERT INTO canvas_elements (id, type, data, z_index)
      VALUES (${id}, ${type}, ${JSON.stringify(data)}, ${z_index})
      RETURNING id, type, data, z_index, created_at, updated_at
    `;
    return NextResponse.json({ element: rows[0] });
  } catch (error) {
    console.error('POST /api/canvas error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PUT /api/canvas — update an existing element
export async function PUT(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  try {
    const { id, data, z_index } = await req.json();
    if (!id || !data) {
      return NextResponse.json({ error: 'Missing required fields: id, data' }, { status: 400 });
    }
    const sql = getDb();
    const rows = z_index !== undefined
      ? await sql`
          UPDATE canvas_elements
          SET data = ${JSON.stringify(data)}, z_index = ${z_index}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, type, data, z_index, created_at, updated_at
        `
      : await sql`
          UPDATE canvas_elements
          SET data = ${JSON.stringify(data)}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, type, data, z_index, created_at, updated_at
        `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Element not found' }, { status: 404 });
    }
    return NextResponse.json({ element: rows[0] });
  } catch (error) {
    console.error('PUT /api/canvas error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE /api/canvas — delete an element
export async function DELETE(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }
    const sql = getDb();
    await sql`DELETE FROM canvas_elements WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/canvas error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
