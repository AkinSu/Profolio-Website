/**
 * Sanitize a URL to prevent javascript: and data: protocol attacks.
 * Returns the URL if safe, or empty string if dangerous.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Block dangerous protocols
  if (/^\s*(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}
