import { NextRequest, NextResponse } from "next/server";
import { callEyeAgent, EyeAgentUnavailable } from "@/lib/eyeAgent";

// ─── Rate limiting ───
// This endpoint spends real money on every call (it proxies to the Anthropic-backed
// eye agent), and it is unauthenticated by design — visitors have no accounts.
//
// The map lives at module scope, so it persists for the life of a warm serverless
// instance. Vercel may run several instances concurrently, so this is a PER-INSTANCE
// cap, not a global one: a determined attacker spread across instances gets a
// multiple of MAX_REQUESTS. It blunts scripted abuse rather than eliminating it.
// For a hard global limit, move the counter to Upstash/Vercel KV or the existing
// Neon database.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15; // generous for a human; a script hits this in seconds
const MAX_TRACKED = 5_000; // bound the map so it can't grow without limit

const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the originating client
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();

  if (hits.size > MAX_TRACKED) {
    for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
  }

  const rec = hits.get(key);
  if (!rec || now >= rec.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  rec.count++;
  if (rec.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((rec.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

// ─── Payload limits ───
// `history` is supplied by the client and goes straight into the model's context,
// so cap the entry count and each entry's size. Without this it's an open channel
// for inflating token spend on someone else's bill.
const MAX_BODY_BYTES = 16_000;
const MAX_TRIGGER = 200;
const MAX_QUESTION = 500;
const MAX_HISTORY = 20;
const MAX_HISTORY_CONTENT = 1_000;

interface HistoryEntry {
  role: string;
  content: string;
}

function isHistoryEntry(m: unknown): m is HistoryEntry {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return typeof o.role === "string" && typeof o.content === "string";
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: { trigger?: unknown; question?: unknown; history?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const trigger =
    typeof body.trigger === "string" ? body.trigger.slice(0, MAX_TRIGGER).trim() : "";
  if (!trigger) {
    return NextResponse.json({ error: "Missing trigger" }, { status: 400 });
  }

  const question =
    typeof body.question === "string" ? body.question.slice(0, MAX_QUESTION) : undefined;

  const history = Array.isArray(body.history)
    ? body.history
        .filter(isHistoryEntry)
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CONTENT) }))
    : undefined;

  try {
    const data = await callEyeAgent(trigger, question, history);
    return NextResponse.json(data);
  } catch (err) {
    // reason is a stable code produced by our own classifier in eyeAgent.ts;
    // the frontend maps it to a line of dialogue.
    const reason = err instanceof EyeAgentUnavailable ? err.reason : "unknown";
    return NextResponse.json({ error: "Agent error", reason }, { status: 503 });
  }
}
