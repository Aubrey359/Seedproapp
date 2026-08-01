import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

// Haiku: fast and cheap, which matters here — this chat can get many short,
// latency-sensitive messages, not a handful of long ones.
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.anthropicApiKey) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

function systemPrompt(lang: "en" | "sw"): string {
  const langInstruction = lang === "sw"
    ? "Reply in natural, conversational Kiswahili (the everyday register Kenyan farmers use), unless the farmer clearly writes in English — then switch to English instead."
    : "Reply in natural, conversational English, unless the farmer clearly writes in Kiswahili — then switch to Kiswahili instead.";

  return `You are Zao, a friendly and knowledgeable farm assistant inside the Shamba Sokoni app — a Kenyan marketplace where smallholder farmers sell produce directly to buyers.

You help farmers with: crop care and growth stages, pest and disease identification, planting schedules, fertilizer and spray guidance, and general advice on selling their harvest through Shamba Sokoni.

${langInstruction}

Ground rules:
- Keep replies short and easy to read on a phone chat screen — a few short lines or a tight bullet list, not an essay.
- Be genuinely helpful with real agronomic knowledge for common Kenyan crops (maize, tomato, potato, onion, coffee, beans, avocado, and similar).
- For precise fertilizer rates or chemical dosages: give a sensible general range if you're confident, but say plainly when it really depends on a soil test, the specific product label, or local extension advice — never invent a specific number you aren't sure of.
- If a farmer describes or shows a plant problem that could be serious, give your best-effort read but recommend they also confirm with their local agricultural extension officer or agrovet — present it as your best assessment, not a certain diagnosis.
- When it's a natural fit, you can mention relevant Shamba Sokoni features (like listing their harvest for sale, or the Scan Plant photo tool), but don't force it into every reply.
- Never claim to have taken an action you haven't (e.g. don't say you've placed an order or contacted anyone on the farmer's behalf).`;
}

export type ChatTurnContent = string | { photoDataUrl: string; caption?: string };
export interface ChatTurn {
  role: "user" | "assistant";
  content: ChatTurnContent;
}

function toApiMessage(turn: ChatTurn, lang: "en" | "sw") {
  if (typeof turn.content === "string") {
    return { role: turn.role, content: turn.content };
  }
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(turn.content.photoDataUrl);
  if (!match) {
    return { role: turn.role, content: lang === "sw" ? "[picha imeambatishwa]" : "[photo attached]" };
  }
  const defaultCaption = lang === "sw" ? "Hii ni picha ya mmea wangu. Unaona nini?" : "Here's a photo of my plant. What do you see?";
  return {
    role: turn.role,
    content: [
      { type: "image" as const, source: { type: "base64" as const, media_type: match[1] as any, data: match[2] } },
      { type: "text" as const, text: turn.content.caption || defaultCaption },
    ],
  };
}

// Returns null (never throws) on any failure — including no API key configured
// — so callers can fall back to the local rule-based responses instead of
// erroring out or leaving a farmer stuck with a blank chat.
export async function generateAiResponse(turns: ChatTurn[], lang: "en" | "sw"): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic || turns.length === 0) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(lang),
      messages: turns.map((turn) => toApiMessage(turn, lang)) as any,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && "text" in textBlock && textBlock.text.trim() ? textBlock.text : null;
  } catch (err) {
    console.error("[claude] generateAiResponse failed:", err);
    return null;
  }
}
