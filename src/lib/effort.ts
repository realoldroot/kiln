import type { Effort, ModelInfo } from "./types"

const LABELS: Record<string, string> = {
  max: "Max",
  xhigh: "Extra high",
  high: "High",
  medium: "Medium",
  low: "Low",
  minimal: "Minimal",
  none: "Off (no thinking)",
  on: "Thinking on",
  off: "Thinking off",
}

export function effortLabel(v: Effort): string {
  return LABELS[v] ?? v
}

/** Short form for message captions ("· max", "· thinking off"). */
export function effortCaption(v: Effort): string {
  if (v === "on") return "thinking on"
  if (v === "off") return "thinking off"
  if (v === "none") return "no thinking"
  return v
}

export interface EffortChoice {
  value: Effort
  label: string
}

/**
 * The effort options a model actually supports, from provider metadata.
 * Empty array = no user-facing control (model has no reasoning, or its
 * reasoning is always-on with no levels).
 */
export function effortChoices(m: ModelInfo | undefined): EffortChoice[] {
  if (!m) return []
  if (m.efforts?.length) {
    return [
      {
        value: "auto",
        label: m.defaultEffort
          ? `Auto (${effortLabel(m.defaultEffort).toLowerCase()})`
          : "Auto (model default)",
      },
      ...m.efforts.map((e) => ({ value: e, label: effortLabel(e) })),
    ]
  }
  if (m.reasoningToggle) {
    return [
      { value: "auto", label: "Auto (model default)" },
      { value: "on", label: LABELS.on },
      { value: "off", label: LABELS.off },
    ]
  }
  return []
}

/** Reset an effort that a newly selected model doesn't support. */
export function coerceEffort(m: ModelInfo | undefined, effort: Effort): Effort {
  if (effort === "auto") return "auto"
  const valid = effortChoices(m).some((c) => c.value === effort)
  return valid ? effort : "auto"
}
