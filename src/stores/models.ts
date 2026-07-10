import { create } from "zustand"
import type { ModelInfo, ModelRef, ProviderId } from "@/lib/types"
import { fetchOpenRouterModels } from "@/lib/providers/openrouter"
import { fetchOllamaModels } from "@/lib/providers/ollama"
import { getSettings } from "./settings"

const CACHE_KEY = "amber-models-cache"

interface ModelsCache {
  openrouter: ModelInfo[]
  ollama: ModelInfo[]
  fetchedAt: number
}

function loadCache(): ModelsCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* corrupted cache */
  }
  return { openrouter: [], ollama: [], fetchedAt: 0 }
}

interface ModelsState {
  openrouter: ModelInfo[]
  ollama: ModelInfo[]
  fetchedAt: number
  loading: boolean
  errors: Partial<Record<ProviderId, string>>
  refresh: (force?: boolean) => Promise<void>
}

export const useModels = create<ModelsState>()((set, get) => ({
  ...loadCache(),
  loading: false,
  errors: {},

  refresh: async (force = false) => {
    const { fetchedAt, loading } = get()
    const s = getSettings()
    // Live-fetch, but avoid hammering: reuse a cache younger than 15 min.
    if (loading) return
    if (!force && Date.now() - fetchedAt < 15 * 60_000) return
    set({ loading: true })
    const errors: Partial<Record<ProviderId, string>> = {}

    const [or, ol] = await Promise.all([
      fetchOpenRouterModels().catch((e) => {
        errors.openrouter = e.message
        return null
      }),
      s.ollamaKey
        ? fetchOllamaModels().catch((e) => {
            errors.ollama = e.message
            return null
          })
        : Promise.resolve(null),
    ])

    const next: ModelsCache = {
      openrouter: or ?? get().openrouter,
      ollama: ol ?? (s.ollamaKey ? get().ollama : []),
      fetchedAt: Date.now(),
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    } catch {
      /* storage full — cache is optional */
    }
    set({ ...next, loading: false, errors })
  },
}))

export function allModels(): ModelInfo[] {
  const st = useModels.getState()
  return [...st.ollama, ...st.openrouter]
}

export function findModel(ref: ModelRef | null): ModelInfo | undefined {
  if (!ref) return undefined
  return allModels().find(
    (m) => m.provider === ref.provider && m.id === ref.model,
  )
}

export function displayModelName(ref: ModelRef | null): string {
  if (!ref) return "Choose model"
  const info = findModel(ref)
  if (info) return info.name
  return ref.model.split("/").pop() ?? ref.model
}
