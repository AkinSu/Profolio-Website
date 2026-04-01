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
    return NextResponse.json({ error: 'Failed to fetch elements' }, { status: 500 });
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

  // Validate element type
  const VALID_TYPES = ['sticky_note', 'text', 'image', 'drawing', 'text_button', 'image_button'];
  if (type && !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid element type' }, { status: 400 });
  }

  // Validate id format (UUID)
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid element id' }, { status: 400 });
  }

  // Drawings: allow unauthenticated, but enforce 100KB size limit + persist zone
  if (type === 'drawing') {
    if (bodyText.length > 100_000) {
      return NextResponse.json({ error: 'Drawing payload too large (max 100KB)' }, { status: 413 });
    }
    // Non-admin drawings must be inside the persist zone
    const adminCheck = requireAdmin(req);
    const isAdminUser = !adminCheck;
    const PERSIST_ZONE = { x1: 1470, y1: 1394, x2: 4003, y2: 3010 };
    const dx = Number(data?.x) || 0;
    const dy = Number(data?.y) || 0;
    const dw = Number(data?.width) || 0;
    const dh = Number(data?.height) || 0;
    const cx = dx + dw / 2;
    const cy = dy + dh / 2;
    const inZone = cx >= PERSIST_ZONE.x1 && cx <= PERSIST_ZONE.x2
                && cy >= PERSIST_ZONE.y1 && cy <= PERSIST_ZONE.y2;
    console.log(`[drawing POST] admin=${isAdminUser} center=(${cx},${cy}) inZone=${inZone} id=${id}`);
    if (!isAdminUser && !inZone) {
      console.log(`[drawing POST] BLOCKED — visitor drawing outside persist zone`);
      return NextResponse.json({ element: { id, type, data, z_index } });
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
    return NextResponse.json({ error: 'Failed to create element' }, { status: 500 });
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
    return NextResponse.json({ error: 'Failed to update element' }, { status: 500 });
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
    return NextResponse.json({ error: 'Failed to delete element' }, { status: 500 });
  }
}
