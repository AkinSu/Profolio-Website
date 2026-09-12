/**
 * UUID v4 generator with a non-secure-context fallback.
 *
 * `crypto.randomUUID()` is only exposed in secure contexts — https://, localhost,
 * or 127.0.0.1. Opening the dev server over a LAN IP (http://192.168.x.x:3000, which
 * is how you'd test on a phone) leaves `crypto` defined but `randomUUID` undefined,
 * which crashes the whole canvas on render. `crypto.getRandomValues()` has no such
 * restriction, so we build the v4 by hand when the native call isn't there.
 *
 * Output is always 36 chars in 8-4-4-4-12 hex form, matching the id format that
 * /api/canvas validates against.
 */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort — ids are not secrets, they only need to be collision-free
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
