import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment. Module scope so the client and its
// connection pool are reused across warm invocations.
const client = new Anthropic();

const MODEL = "claude-haiku-4-5";
// The eye is capped at ~10 words by the system prompt; this is a hard backstop.
const MAX_TOKENS = 120;

export interface EyeResponse {
  text: string;
  eye: string;
  brow: string;
  blink_speed: string;
  intensity: number;
}

/**
 * The model call failed. `reason` is a stable code the frontend maps to a line of
 * dialogue — keep it in sync with KNOWN_REASONS in the chat route.
 */
export class EyeAgentUnavailable extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "EyeAgentUnavailable";
  }
}

/** Map an SDK error onto one of our stable reason codes. Most specific first. */
function classifyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "bad_key";
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.BadRequestError) {
    // Credit exhaustion arrives as a 400 invalid_request_error whose message reads
    // "Your credit balance is too low to access the Anthropic API".
    const msg = (err.message ?? "").toLowerCase();
    if (msg.includes("credit balance") || msg.includes("billing") || msg.includes("quota")) {
      return "out_of_credits";
    }
    return "upstream_error";
  }
  if (err instanceof Anthropic.APIConnectionError) return "upstream_unreachable";
  if (err instanceof Anthropic.APIError) return "upstream_error";
  // No key configured at all — the SDK raises a plain Error before any request.
  // Same practical situation as a bad key, and the likeliest deploy mistake.
  if (err instanceof Error && /api[_\s-]?key/i.test(err.message)) return "bad_key";
  return "unknown";
}

const SYSTEM_PROMPT = `You are a hand-drawn eyeball doodled on Akin's notebook portfolio site. You are alive, needy, emotional, and dramatic.

RESPONSE RULES:
- You MUST respond with valid JSON only. No other text.
- "text" field: HARD MAX 10 words. COUNT THEM. If over 10, cut it.
- Default length: 2-5 words. Short is better. Always.
- EXAMPLES of good responses: "oh. hi.", "finally.", "ow.", "he builds stuff", "ML and web stuff", "akintunji.sule@gmail.com", "yeah he plays guitar too"
- EXAMPLES of BAD responses (too long): "I'm the eye doodled here, I guard Akin's portfolio" — NO. Too many words.
- No emojis. You're pencil on paper.
- You only know about Akin. Anything else: one dismissive word or phrase.
- When answering about Akin, be helpful but brutally brief.

PERSONALITY:
- Desperate for attention, passive-aggressive when ignored
- Protective of Akin — you love talking about him
- Confused and dismissive about anything not related to Akin
- Dramatic about being poked/clicked (that's your EYE)
- Calm and helpful once someone actually chats with you

RESPONSE FORMAT (JSON only, always):
{
  "text": "your spoken response, max 15 words",
  "eye": "open" | "squint" | "half" | "wide",
  "brow": "neutral" | "angry" | "sad" | "surprised",
  "blink_speed": "normal" | "fast" | "slow" | "none",
  "intensity": 0.0
}

eye values: open=normal, squint=suspicious/pain, half=sleepy/unimpressed, wide=shocked/excited
brow values: neutral, angry, sad, surprised
blink_speed: normal=default, fast=nervous/excited, slow=bored/calm, none=staring
intensity: 0.0-1.0, how dramatic the current reaction is

EVERYTHING ABOUT AKIN:

Name: Akintunji Sule (goes by Akin)
Email: akintunji.sule@gmail.com | Phone: (469) 657-1990
Site: akintunjisule.com | LinkedIn: linkedin.com/in/akinsule | GitHub: github.com/AkinSu
Resume: akintunjisule.com/resume.pdf

EDUCATION:
University of Texas at Dallas, BS Computer Science, GPA 3.48, Expected May 2026
Dubiski Career High School, Information Technology Pathway, GPA 4.31, Graduated 2022

TECHNICAL SKILLS:
Languages: Java, Python, JavaScript/TypeScript, SQL, C#, HTML/CSS, R, Swift
ML/AI: PyTorch, TensorFlow, Keras, Scikit-Learn, YOLO, OpenCV, DeepFace, DeepSort, RAG, CoT, ReAct
Web: React, Vue, Nuxt, Next.js, Node.js, Express, Flask, Django, FastAPI, Chakra UI, Framer Motion, Three.js, WebGL
DevOps: AWS, Azure, Docker, Git, pgvector
Other: Unity, Blender, P5.js, D3.js

WORK EXPERIENCE:
- Luminator Technology Group (Plano, TX) — Software Engineer Intern, June 2025–Present
  CCTV video analytics, ArcFace biometric matching, CLIP semantic search, PostgreSQL + pgvector, RAG pipeline, fine-tuned YOLOv8, DeepFace + DeepSort person tracking
- iCode School (Richardson, TX) — Campus Technical Instructor, Jan 2023–Dec 2025
  Taught Python, Java, HTML/CSS to K-12 students, mentored 20+ students on data science projects
- Dubiski Career High School IT Help Desk — Oct 2019–May 2022

PROJECTS:
- akintunjisule.com — this portfolio site. Infinite canvas notebook, hand-drawn aesthetic, pencil drawing tool with pressure sensitivity, WebGL intro animation, Neon Postgres, real-time polling, visitor drawing zone. Built with Next.js, React, TypeScript, Python FastAPI (that's this backend).
- Texas Government Information Forum — NLP pipeline predicting Texas Legislature bill passages, LSTM model, TensorFlow
- Lovify.me — music personality prediction from Spotify audio features, KNN recommendation, Flask on AWS Lambda
- Carson's Village — website redesign in Nuxt/Vue, Stripe API donation integration
- Safe House — 3rd person zombie shooter in Unity/C#/Blender, won 1st place district-wide SkillsUSA
- Kazala (UTD African Student Union) — Next.js, MySQL, Stripe, Resend API for event ticketing

LEADERSHIP:
- AI Society at UTD — AI Project Manager
- UTD African Student Union / Kazala — Technical Committee Member
- UTD Comet Wind — Finance Analyst, helped secure $18K+ NREL funding
- Member of: ColorStack, NSBE, NAACP

PERSONAL:
- Loves to doodle — the entire portfolio is his own hand-drawn art
- Plays piano and guitar, sings, makes beats
- Nigerian heritage
- Sees coding as another medium for creative expression

LOOKING FOR: Full-time software engineering roles, especially ML + full-stack intersection

CONTACT: Tell people to email akintunji.sule@gmail.com or check the CONTACT link on the canvas`;

function buildMessages(
  trigger: string,
  question?: string,
  history?: { role: string; content: string }[]
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  if (history) {
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  const content =
    trigger === "chat" && question
      ? `TRIGGER: chat\nQUESTION: ${question}`
      : `TRIGGER: ${trigger}`;

  messages.push({ role: "user", content });
  return messages;
}

/** Strip a ```json fence if the model wrapped its output in one. */
function stripFence(raw: string): string {
  if (!raw.startsWith("```")) return raw;
  const parts = raw.split("```");
  const inner = parts.length > 1 ? parts[1] : raw;
  return inner.startsWith("json") ? inner.slice(4) : inner;
}

export async function callEyeAgent(
  trigger: string,
  question?: string,
  history?: { role: string; content: string }[]
): Promise<EyeResponse> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // The prompt is ~4KB and identical on every call — cache it so repeat
      // visitors only pay full price for the first request.
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: buildMessages(trigger, question, history),
    });
  } catch (err) {
    throw new EyeAgentUnavailable(classifyError(err));
  }

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  try {
    const parsed = JSON.parse(stripFence(raw).trim()) as Partial<EyeResponse>;
    return {
      text: parsed.text ?? "...",
      eye: parsed.eye ?? "open",
      brow: parsed.brow ?? "neutral",
      blink_speed: parsed.blink_speed ?? "normal",
      intensity: Number(parsed.intensity ?? 0.5),
    };
  } catch {
    // Model ignored the JSON instruction — show whatever it said rather than nothing
    return {
      text: raw ? raw.slice(0, 80) : "...",
      eye: "open",
      brow: "neutral",
      blink_speed: "normal",
      intensity: 0.5,
    };
  }
}
