// ─── Stroke compression: simplify, encode to flat arrays, decode back ───

interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

export interface CompressedStroke {
  d: number[]; // flat: [x, y, pressure, tiltX, tiltY, x, y, ...]
}

export interface DrawingData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  strokes: CompressedStroke[];
}

// ─── Douglas-Peucker point simplification ───

function perpendicularDistance(
  px: number, py: number,
  lx1: number, ly1: number,
  lx2: number, ly2: number
): number {
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - lx1) ** 2 + (py - ly1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - lx1) * dx + (py - ly1) * dy) / lenSq));
  const projX = lx1 + t * dx;
  const projY = ly1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(
      points[i].x, points[i].y,
      first.x, first.y,
      last.x, last.y
    );
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

export function simplifyStroke(points: Point[], tolerance = 1.0): Point[] {
  return douglasPeucker(points, tolerance);
}

// ─── Bounding box ───

export function computeBoundingBox(allPoints: Point[]): { x: number; y: number; width: number; height: number } {
  if (allPoints.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Add padding for brush tip size
  const pad = 10;
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

// ─── Encode: Point[] → CompressedStroke (relative to bbox origin) ───

export function encodeStroke(points: Point[], originX: number, originY: number): CompressedStroke {
  const d: number[] = [];
  for (const p of points) {
    d.push(
      Math.round((p.x - originX) * 10) / 10,
      Math.round((p.y - originY) * 10) / 10,
      Math.round(p.pressure * 100) / 100,
      p.tiltX ?? 0,
      p.tiltY ?? 0
    );
  }
  return { d };
}

// ─── Decode: CompressedStroke → Point[] (absolute coords given origin) ───

export function decodeStroke(stroke: CompressedStroke, originX: number, originY: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < stroke.d.length; i += 5) {
    const tiltX = stroke.d[i + 3];
    const tiltY = stroke.d[i + 4];
    points.push({
      x: stroke.d[i] + originX,
      y: stroke.d[i + 1] + originY,
      pressure: stroke.d[i + 2],
      tiltX: tiltX === 0 ? undefined : tiltX,
      tiltY: tiltY === 0 ? undefined : tiltY,
    });
  }
  return points;
}

// ─── Full pipeline: raw stroke → compressed drawing data ───

export function compressStroke(
  rawPoints: Point[],
  canvasYOffset: number
): DrawingData | null {
  if (rawPoints.length < 2) return null;

  const simplified = simplifyStroke(rawPoints, 1.0);
  if (simplified.length < 2) return null;

  // Convert canvas-local coords to world coords (add canvas Y offset)
  const worldPoints = simplified.map(p => ({
    ...p,
    y: p.y + canvasYOffset,
  }));

  const bbox = computeBoundingBox(worldPoints);
  if (bbox.width < 1 && bbox.height < 1) return null;

  const encoded = encodeStroke(worldPoints, bbox.x, bbox.y);

  return {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    rotation: 0,
    strokes: [encoded],
  };
}
