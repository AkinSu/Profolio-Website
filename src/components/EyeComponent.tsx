"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MotionValue } from "framer-motion";
import { SpeechBubble } from "./SpeechBubble";

export type LidState = "open" | "half" | "closed";
type BlinkSpeed = "normal" | "fast" | "slow" | "none";
type Mood = "idle" | "chatting";

interface AgentResponse {
  text: string;
  eye: string;
  brow: string;
  blink_speed: BlinkSpeed;
  intensity: number;
}

interface EyeProps {
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
  zoom: number;
  flipped?: boolean;
  shutState?: LidState | null;
  primary?: boolean;
  onShutClick?: () => void;
  isShutdown?: boolean;
  isMobile?: boolean;
}

const LID_SRC: Record<LidState, string> = {
  open: "/eye_lid_open_web.png",
  half: "/eye_lid_half_web.png",
  closed: "/eye_lid_closed_web.png",
};

const RX = 15;
const RY = 8;

const TRIGGER_COOLDOWN_MS = 30_000;
const IDLE_SECONDS = 20;

function triggerKey(trigger: string): string {
  if (trigger.includes("arrived") || trigger.includes("viewport") || trigger.includes("came back")) return "arrive";
  if (trigger.includes("panning away") || trigger.includes("leaving")) return "leave";
  if (trigger.includes("ignoring")) return "ignored";
  if (trigger.includes("poked")) return "poke";
  if (trigger.includes("zoomed")) return "zoom";
  return trigger;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

// Pre-built instant reactions — shown immediately while API is in flight
// eye: null means don't touch the lid (viewport triggers should leave it alone)
const INSTANT: Record<string, { texts: string[]; eye: LidState | null; blink: BlinkSpeed }> = {
  arrive:  { texts: ["oh. hey.",         "oh. you're back.", "hi again."],    eye: null,   blink: "normal" },
  leave:   { texts: ["wait—",            "seriously??",      "FINE. LEAVE."], eye: null,   blink: "normal" },
  ignored: { texts: ["hello??",          "...hello?",        "I'M RIGHT HERE"], eye: null, blink: "none"   },
  poke:    { texts: ["OW",               "STOP IT",          "I SAID OW"],    eye: "half", blink: "fast"   },
  zoom:    { texts: ["I can barely see you", "getting smaller...", "HEY"],    eye: null,   blink: "fast"   },
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Blink coordinator ───
// One loop drives both eyes so they stay in sync. It deliberately lives outside
// React: the previous version held lid state in HomeContent, so every blink
// re-rendered the entire canvas four times inside 240ms — that was the stutter.
// Subscribers swap img.src directly and nothing re-renders.

type BlinkPhase = "rest" | "mid" | "shut";

// Real eyelids snap shut and drift back open, so closing is quicker than opening.
const BLINK_CLOSING_MS = 55;
const BLINK_SHUT_MS = 35;
const BLINK_OPENING_MS = 95;
// People blink every few seconds, in irregular clusters rather than on a metronome.
const BLINK_GAP_MIN_MS = 2800;
const BLINK_GAP_JITTER_MS = 2700;
const DOUBLE_BLINK_CHANCE = 0.12;

const blinkListeners = new Set<(phase: BlinkPhase) => void>();
let blinkLoopRunning = false;

function emitBlink(phase: BlinkPhase) {
  for (const listener of blinkListeners) listener(phase);
}

async function oneBlink() {
  emitBlink("mid");
  await sleep(BLINK_CLOSING_MS);
  emitBlink("shut");
  await sleep(BLINK_SHUT_MS);
  emitBlink("mid");
  await sleep(BLINK_OPENING_MS);
  emitBlink("rest");
}

async function blinkLoop() {
  while (blinkListeners.size > 0) {
    await sleep(BLINK_GAP_MIN_MS + Math.random() * BLINK_GAP_JITTER_MS);
    if (blinkListeners.size === 0) break;
    await oneBlink();
    if (Math.random() < DOUBLE_BLINK_CHANCE) {
      await sleep(140);
      await oneBlink();
    }
  }
  blinkLoopRunning = false;
}

function subscribeBlink(fn: (phase: BlinkPhase) => void): () => void {
  blinkListeners.add(fn);
  if (!blinkLoopRunning) {
    blinkLoopRunning = true;
    void blinkLoop();
  }
  return () => {
    blinkListeners.delete(fn);
  };
}

/**
 * What the lid shows right now.
 *
 * `resting` is where the eye sits between blinks — "open" normally, "half" while
 * squinting from a click, "closed" once it has been shut for good.
 *
 * An eye that's been shut for good never blinks. A squinting one still does, but it
 * blinks relative to the squint: half -> closed -> half, returning to the squint
 * rather than to open, until the squint timer releases it.
 */
function resolveLid(resting: LidState, phase: BlinkPhase): LidState {
  if (resting === "closed") return "closed";
  if (phase === "shut") return "closed";
  if (phase === "mid") return "half";
  return resting;
}

// What the eye says when it can't reach the model. Keys are the reason codes
// whitelisted in /api/chat; keep the two in sync. Staying in character matters more
// than being informative — a visitor should read this as personality, not an error.
const FAILURE_LINES: Record<string, string> = {
  out_of_credits: "damn. i think akin's broke and out of credits.",
  rate_limited: "slow down. ask me again in a sec.",
  bad_key: "akin broke something. typical.",
  agent_down: "my brain's offline. try later.",
  upstream_unreachable: "my brain's offline. try later.",
};
const FAILURE_FALLBACK = "...can't think right now.";

function failureLine(reason: string): string {
  return FAILURE_LINES[reason] ?? FAILURE_FALLBACK;
}

type AgentResult =
  | { ok: true; data: AgentResponse }
  | { ok: false; reason: string };

async function callAgent(
  trigger: string,
  question?: string,
  history?: { role: string; content: string }[]
): Promise<AgentResult> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger, question, history }),
    });
    if (!res.ok) {
      let reason = "upstream_error";
      try {
        const body = (await res.json()) as { reason?: unknown };
        if (typeof body.reason === "string") reason = body.reason;
      } catch {
        // non-JSON error response; keep the default
      }
      return { ok: false, reason };
    }
    return { ok: true, data: (await res.json()) as AgentResponse };
  } catch {
    return { ok: false, reason: "agent_down" };
  }
}

export function EyeComponent({
  canvasX,
  canvasY,
  width,
  height,
  offsetX,
  offsetY,
  zoom,
  flipped = false,
  shutState,
  primary = false,
  onShutClick,
  isShutdown = false,
  isMobile = false,
}: EyeProps) {
  const pupilRef = useRef<HTMLImageElement>(null);

  const lidRef = useRef<HTMLImageElement>(null);
  // Where the lid sits between blinks. Driven by the click easter egg, not the agent.
  const restingRef = useRef<LidState>(shutState ?? "open");
  const phaseRef = useRef<BlinkPhase>("rest");
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleLoading, setBubbleLoading] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Push the current lid straight to the DOM — no re-render, so blinks stay smooth.
  const applyLid = useCallback(() => {
    const lid = resolveLid(restingRef.current, phaseRef.current);
    if (lidRef.current) lidRef.current.src = LID_SRC[lid];
    // The pupil is stacked above the lid, so it has to be hidden when fully shut.
    if (pupilRef.current) {
      pupilRef.current.style.visibility = lid === "closed" ? "hidden" : "visible";
    }
  }, []);

  // Squint state changes rarely (only on click), so a re-render here is fine.
  useEffect(() => {
    restingRef.current = shutState ?? "open";
    applyLid();
  }, [shutState, applyLid]);

  // Blinks arrive from the shared loop and bypass React entirely.
  useEffect(() => subscribeBlink((phase) => {
    phaseRef.current = phase;
    applyLid();
  }), [applyLid]);

  const zoomRef = useRef(zoom);
  const triggerCooldowns = useRef<Map<string, number>>(new Map());
  const triggerCounts = useRef<Map<string, number>>(new Map());
  const inViewportRef = useRef(false);
  const nearEdgeRef = useRef(false);
  // Armed only once the eye has sat away from the edges — see checkViewport
  const hasBeenCentralRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadGreetingRef = useRef(false);
  const zoomedSmallRef = useRef(zoom < 0.5);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);


  const pupilW = width * 0.20;
  const pupilH = height * 0.20;
  const pupilLeft = (width - pupilW) / 2;
  const pupilTop = (height - pupilH) / 2;

  const isInViewport = useCallback((): boolean => {
    const z = zoomRef.current;
    const screenX = canvasX * z + offsetX.get();
    const screenY = canvasY * z + offsetY.get();
    return (
      screenX > -width * z &&
      screenX < window.innerWidth + width * z &&
      screenY > -height * z &&
      screenY < window.innerHeight + height * z
    );
  }, [canvasX, canvasY, width, height, offsetX, offsetY]);

  // "About to leave" — eye center inside the viewport's edge band. Scaled down on
  // small screens: a flat 100px leaves barely any central region on a phone, so the
  // eye would read as near-edge almost everywhere.
  const isNearEdge = useCallback((): boolean => {
    const z = zoomRef.current;
    const screenX = canvasX * z + offsetX.get();
    const screenY = canvasY * z + offsetY.get();
    const EDGE = Math.min(100, window.innerWidth * 0.15, window.innerHeight * 0.15);
    return (
      screenX < EDGE ||
      screenX > window.innerWidth - EDGE ||
      screenY < EDGE ||
      screenY > window.innerHeight - EDGE
    );
  }, [canvasX, canvasY, offsetX, offsetY]);

  // Fire an emotional trigger: show instant reaction immediately, API swaps text after
  const fireTrigger = useCallback(async (trigger: string, question?: string) => {
    if (!primary || isShutdown) return;

    if (trigger !== "chat") {
      const key = triggerKey(trigger);
      const last = triggerCooldowns.current.get(key) ?? 0;
      if (Date.now() - last < TRIGGER_COOLDOWN_MS) return;
      triggerCooldowns.current.set(key, Date.now());

      const count = (triggerCounts.current.get(key) ?? 0) + 1;
      triggerCounts.current.set(key, count);

      // 1. Show instant pre-built reaction RIGHT NOW
      const instant = INSTANT[key];
      if (instant) {
        const idx = Math.min(count - 1, instant.texts.length - 1);
        setBubble(instant.texts[idx]);
      }

      // 2. Build escalated trigger message
      const escalated = count > 1
        ? `${trigger} (${ordinal(count)} time)`
        : trigger;

      // 3. Fire API in background — swap the text in when it arrives.
      // The lid is never touched here: agent-driven lids only ever moved the primary
      // eye, which left one eye half-closed while the other stayed open.
      callAgent(escalated).then((result) => {
        // On failure, leave the instant reaction up — ambient triggers stay alive
        // without the model, so a broke eye still blinks and reacts.
        if (!result.ok) return;
        setBubble(result.data.text);
      });

      return;
    }

    // Chat: show "..." immediately, replace with response
    setBubble("...");
    setBubbleLoading(true);
    const result = await callAgent(trigger, question, chatHistory);
    setBubbleLoading(false);

    if (!result.ok) {
      // Stay in character rather than leaving an empty bubble. Nothing is cached,
      // so the next question retries the API — it recovers on its own if akin tops up.
      setBubble(failureLine(result.reason));
      return;
    }

    const resp = result.data;
    setBubble(resp.text);

    if (question) {
      setChatHistory((h) => [
        ...h,
        { role: "user", content: `TRIGGER: chat\nQUESTION: ${question}` },
        { role: "assistant", content: JSON.stringify(resp) },
      ]);
    }
  }, [primary, isShutdown, chatHistory]);

  // Cursor tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pupilRef.current || !isInViewport()) return;
      const z = zoomRef.current;
      const eyeScreenX = canvasX * z + offsetX.get();
      const eyeScreenY = canvasY * z + offsetY.get();
      const rawDx = (e.clientX - eyeScreenX) / z;
      const rawDy = (e.clientY - eyeScreenY) / z;
      const nx = rawDx / RX;
      const ny = rawDy / RY;
      const mag = Math.sqrt(nx * nx + ny * ny);
      const s = mag > 1 ? 1 / mag : 1;
      pupilRef.current.style.transform = `translate(${rawDx * s}px, ${rawDy * s}px)`;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [canvasX, canvasY, offsetX, offsetY, isInViewport]);


  // Viewport detection — stable via refs
  const fireTriggerRef = useRef(fireTrigger);
  useEffect(() => { fireTriggerRef.current = fireTrigger; }, [fireTrigger]);
  const moodRef = useRef(mood);
  useEffect(() => { moodRef.current = mood; }, [mood]);

  useEffect(() => {
    if (!primary) return;

    const checkViewport = () => {
      const nowInView = isInViewport();
      const nowNearEdge = isNearEdge();

      if (nowInView && !inViewportRef.current) {
        inViewportRef.current = true;
        nearEdgeRef.current = false;
        // The eye almost always enters through the edge band, so keep "leaving"
        // disarmed until it has actually sat somewhere central.
        hasBeenCentralRef.current = false;
        if (!hadGreetingRef.current) {
          hadGreetingRef.current = true;
          fireTriggerRef.current("user just arrived in your viewport");
        } else {
          fireTriggerRef.current("user came back to look at you");
        }
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          if (inViewportRef.current && moodRef.current === "idle") {
            fireTriggerRef.current("user has been near you for 20 seconds ignoring you");
          }
        }, IDLE_SECONDS * 1000);
      } else if (!nowInView && inViewportRef.current) {
        inViewportRef.current = false;
        hasBeenCentralRef.current = false;
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      } else if (nowInView && !nowNearEdge) {
        // Comfortably inside: arm the leave trigger, and clear nearEdgeRef so it can
        // fire again the next time the user pans toward an edge.
        hasBeenCentralRef.current = true;
        nearEdgeRef.current = false;
      } else if (nowInView && nowNearEdge && hasBeenCentralRef.current && !nearEdgeRef.current) {
        nearEdgeRef.current = true;
        hasBeenCentralRef.current = false;
        fireTriggerRef.current("user is panning away from you");
      }
    };

    // Both interval (150ms) and immediate motion-value hooks
    const interval = setInterval(checkViewport, 150);
    const unsubX = offsetX.on("change", checkViewport);
    const unsubY = offsetY.on("change", checkViewport);

    return () => {
      clearInterval(interval);
      unsubX();
      unsubY();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [primary, isInViewport, isNearEdge, offsetX, offsetY]);

  // Zoom trigger — once when crossing below 0.5, resets above 0.7
  useEffect(() => {
    if (!primary) return;
    if (zoom < 0.5 && !zoomedSmallRef.current) {
      zoomedSmallRef.current = true;
      fireTrigger(`user zoomed out to ${Math.round(zoom * 100)}%, you're tiny`);
    } else if (zoom > 0.7) {
      zoomedSmallRef.current = false;
    }
  }, [primary, zoom, fireTrigger]);

  // Click handler — shutdown sequence only, no poke trigger from clicks
  const handleEyeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShutClick) onShutClick();
  }, [onShutClick]);

  // Chat submit
  const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    setMood("chatting");
    await fireTrigger("chat", q);
    setChatLoading(false);
  }, [chatInput, chatLoading, fireTrigger]);

  return (
    <>
      {/* Speech bubble — HTML canvas+div rendered directly in canvas space */}
      {bubble && primary && !isShutdown && (
        <SpeechBubble
          text={bubble}
          eyeCanvasX={canvasX}
          eyeCanvasY={canvasY}
          eyeWidth={width}
          eyeHeight={height}
          loading={bubbleLoading}
          onClick={mood !== "chatting" ? () => setMood("chatting") : undefined}
        />
      )}

      {/* "Tap to chat" hint — shown when bubble is visible and not yet chatting */}
      {bubble && primary && !isShutdown && mood === "idle" && (
        <div
          style={{
            position: "absolute",
            left: canvasX + width * 0.52,
            top: canvasY - height / 2 - 18,
            fontFamily: "'PaperHand', cursive",
            fontSize: 12,
            color: "#9a8f84",
            transform: "rotate(4deg)",
            pointerEvents: "none",
            zIndex: 13,
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          tap bubble to ask questions
        </div>
      )}

      {/* Eye container */}
      <div
        onClick={handleEyeClick}
        style={{
          position: "absolute",
          left: canvasX - width / 2,
          top: canvasY - height / 2,
          width,
          height,
          userSelect: "none",
          zIndex: 5,
          cursor: (primary || onShutClick) ? "pointer" : "default",
        }}
      >
        <img
          ref={lidRef}
          src={LID_SRC[shutState ?? "open"]}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: flipped ? "scaleX(-1)" : undefined,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
        {/* Always mounted — applyLid toggles visibility by ref so blinks don't re-render */}
        {(
          <img
            ref={pupilRef}
            src="/eye_pupil_web.png"
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: pupilLeft,
              top: pupilTop,
              width: pupilW,
              height: pupilH,
              objectFit: "contain",
              transition: "transform 0.08s ease-out",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Chat input — fixed to viewport bottom on mobile, canvas-space on desktop */}
      {primary && mood === "chatting" && !isShutdown && (
        isMobile
          ? createPortal(
              <div
                style={{
                  position: "fixed",
                  bottom: 100,
                  left: 0,
                  right: 0,
                  zIndex: 9990,
                  display: "flex",
                  justifyContent: "center",
                  padding: "0 16px",
                  pointerEvents: "all",
                }}
              >
                <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: 6, width: "100%", maxWidth: 400 }}>
                  <input
                    autoFocus
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="ask me about Akin..."
                    disabled={chatLoading}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontFamily: "'PaperHand', cursive",
                      fontSize: 16,
                      background: "#f5f5f0",
                      border: "1.5px solid #292524",
                      borderRadius: 4,
                      outline: "none",
                      color: "#292524",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading}
                    style={{
                      padding: "8px 14px",
                      fontFamily: "'PaperHand', cursive",
                      fontSize: 15,
                      background: "#292524",
                      color: "#f5f5f0",
                      border: "none",
                      borderRadius: 4,
                      cursor: chatLoading ? "wait" : "pointer",
                    }}
                  >
                    {chatLoading ? "..." : "ask"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMood("idle")}
                    style={{
                      padding: "8px 10px",
                      fontFamily: "'PaperHand', cursive",
                      fontSize: 15,
                      background: "transparent",
                      color: "#999",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </form>
              </div>,
              document.body
            )
          : <div
              style={{
                position: "absolute",
                left: canvasX - 120,
                top: canvasY + height / 2 + 20,
                zIndex: 1000,
                pointerEvents: "all",
                transform: `scale(${1 / zoom})`,
                transformOrigin: "top left",
              }}
            >
              <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="ask me about Akin..."
                  disabled={chatLoading}
                  style={{
                    width: 220,
                    padding: "6px 10px",
                    fontFamily: "'PaperHand', cursive",
                    fontSize: 15,
                    background: "#f5f5f0",
                    border: "1.5px solid #292524",
                    borderRadius: 4,
                    outline: "none",
                    color: "#292524",
                  }}
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  style={{
                    padding: "6px 10px",
                    fontFamily: "'PaperHand', cursive",
                    fontSize: 15,
                    background: "#292524",
                    color: "#f5f5f0",
                    border: "none",
                    borderRadius: 4,
                    cursor: chatLoading ? "wait" : "pointer",
                  }}
                >
                  {chatLoading ? "..." : "ask"}
                </button>
                <button
                  type="button"
                  onClick={() => setMood("idle")}
                  style={{
                    padding: "6px 8px",
                    fontFamily: "'PaperHand', cursive",
                    fontSize: 13,
                    background: "transparent",
                    color: "#999",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </form>
            </div>
      )}
    </>
  );
}
