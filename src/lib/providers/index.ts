import type { ChatRequest, ProviderId, StreamEvent } from "@/lib/types"
import { streamOpenRouter } from "./openrouter"
import { streamOllama } from "./ollama"

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  openrouter: "OpenRouter",
  ollama: "Ollama",
}

export function streamChat(
  provider: ProviderId,
  req: ChatRequest,
): AsyncGenerator<StreamEvent> {
  return provider === "openrouter" ? streamOpenRouter(req) : streamOllama(req)
}

/** One-shot, non-streaming completion (used for chat titles). */
export async function completeText(
  provider: ProviderId,
  req: ChatRequest,
): Promise<string> {
  let out = ""
  for await (const ev of streamChat(provider, req)) {
    if (ev.type === "text") out += ev.text
  }
  return out.trim()
}
