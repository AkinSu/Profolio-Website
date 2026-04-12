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
  lidState?: LidState;
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

// Map agent "eye" field → valid LidState
function mapAgentEye(eye: string): LidState {
  if (eye === "closed") return "closed";
  if (eye === "half" || eye === "squint") return "half";
  return "open"; // "open", "wide", or anything else
}

function triggerKey(trigger: string): string {
  if (trigger.includes("arrived") || trigger.includes("viewport") || trigger.includes("came back")) return "arrive";
  if (trigger.includes("panning away") || trigger.includes("leaving")) return "leave";
  if (trigger.includes("ignoring")) return "ignored";
  if (trigger.includes("poked")) return "poke";
  if (trigger.includes("zoomed")) return "zoom";
  return trigger;
}

// Triggers that should NOT override eye lid from API response
const PASSIVE_TRIGGERS = new Set(["arrive", "leave", "ignored"]);


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

async function callAgent(
  trigger: string,
  question?: string,
  history?: { role: string; content: string }[]
): Promise<AgentResponse | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger, question, history }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
  lidState,
  shutState,
  primary = false,
  onShutClick,
  isShutdown = false,
  isMobile = false,
}: EyeProps) {
  const pupilRef = useRef<HTMLImageElement>(null);

  const [internalLid, setInternalLid] = useState<LidState>("open");
  const lid = lidState ?? internalLid;
  const isBlinkingRef = useRef(false);

  // Agent-driven lid and blink (only applies when NOT in shutState)
  const [agentLid, setAgentLid] = useState<LidState | null>(null);
  const [blinkSpeed, setBlinkSpeed] = useState<BlinkSpeed>("normal");
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleLoading, setBubbleLoading] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Priority: shutState > agentLid > lid
  const activeLid = shutState != null ? shutState : (agentLid ?? lid);

  const zoomRef = useRef(zoom);
  const triggerCooldowns = useRef<Map<string, number>>(new Map());
  const triggerCounts = useRef<Map<string, number>>(new Map());
  const inViewportRef = useRef(false);
  const nearEdgeRef = useRef(false);
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

  // "About to leave" — eye center within 100px of any viewport edge
  const isNearEdge = useCallback((): boolean => {
    const z = zoomRef.current;
    const screenX = canvasX * z + offsetX.get();
    const screenY = canvasY * z + offsetY.get();
    const EDGE = 100;
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
        if (instant.eye !== null) {
          setAgentLid(instant.eye);
          setTimeout(() => setAgentLid(null), 5000);
        }
        setBlinkSpeed(instant.blink);
        setTimeout(() => setBlinkSpeed("normal"), 5000);
      }

      // 2. Build escalated trigger message
      const escalated = count > 1
        ? `${trigger} (${ordinal(count)} time)`
        : trigger;

      // 3. Fire API in background — swap text when it arrives
      // Passive triggers (arrive/leave/ignored) don't override lid from API
      callAgent(escalated).then((resp) => {
        if (!resp) return;
        setBubble(resp.text);
        if (!PASSIVE_TRIGGERS.has(key)) {
          setAgentLid(mapAgentEye(resp.eye));
          setBlinkSpeed(resp.blink_speed);
          setTimeout(() => setAgentLid(null), 5000);
        }
      });

      return;
    }

    // Chat: show "..." immediately, replace with response
    setBubble("...");
    setBubbleLoading(true);
    const resp = await callAgent(trigger, question, chatHistory);
    setBubbleLoading(false);
    if (!resp) { setBubble(null); return; }

    setBubble(resp.text);
    setAgentLid(mapAgentEye(resp.eye));
    setBlinkSpeed(resp.blink_speed);
    setTimeout(() => setAgentLid(null), 5000);

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

  // Internal blink loop (when not externally controlled)
  useEffect(() => {
    if (lidState !== undefined) return;
    let cancelled = false;

    const getDelay = () => {
      if (blinkSpeed === "fast") return 800 + Math.random() * 1200;
      if (blinkSpeed === "slow") return 8000 + Math.random() * 6000;
      if (blinkSpeed === "none") return 99999;
      return 6000 + Math.random() * 8000;
    };

    const doBlink = async () => {
      if (isBlinkingRef.current) return;
      isBlinkingRef.current = true;
      setInternalLid("half");
      await sleep(80);
      if (cancelled) return;
      setInternalLid("closed");
      await sleep(80);
      if (cancelled) return;
      setInternalLid("half");
      await sleep(80);
      if (cancelled) return;
      setInternalLid("open");
      isBlinkingRef.current = false;
    };

    const schedule = () => {
      setTimeout(async () => {
        if (cancelled) return;
        await doBlink();
        if (!cancelled) schedule();
      }, getDelay());
    };

    schedule();
    return () => {
      cancelled = true;
      // If a blink was in progress when this effect re-ran, unstick the lid
      isBlinkingRef.current = false;
      setInternalLid("open");
    };
  }, [lidState, blinkSpeed]);

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
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      } else if (nowInView && nowNearEdge && !nearEdgeRef.current) {
        nearEdgeRef.current = true;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          src={LID_SRC[activeLid]}
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
        {activeLid !== "closed" && (
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
