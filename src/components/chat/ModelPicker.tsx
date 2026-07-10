import { useEffect } from "react"
import {
  BrainIcon,
  CheckIcon,
  EyeIcon,
  ImageIcon,
  KeyIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { useModels } from "@/stores/models"
import { useSettings } from "@/stores/settings"
import type { ModelInfo, ModelRef } from "@/lib/types"
import { PROVIDER_NAMES } from "@/lib/providers"
import { cn, timeAgo } from "@/lib/utils"

function ctxLabel(ctx?: number): string {
  if (!ctx) return ""
  return ctx >= 1_000_000
    ? `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 ? 1 : 0)}M`
    : `${Math.round(ctx / 1000)}K`
}

function priceLabel(m: ModelInfo): string {
  if (!m.pricing) return ""
  const p = m.pricing.prompt ?? 0
  const c = m.pricing.completion ?? 0
  if (p === 0 && c === 0) return "free"
  return `$${p < 0.1 ? p.toFixed(2) : p.toFixed(p < 10 ? 1 : 0)}/M`
}

function ModelRow({
  m,
  selected,
  onSelect,
}: {
  m: ModelInfo
  selected: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`${m.provider} ${m.id} ${m.name}`}
      onSelect={onSelect}
      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium">{m.name}</span>
          {m.reasoning && <BrainIcon className="size-3.5 shrink-0 text-primary/70" />}
          {m.vision && <EyeIcon className="size-3.5 shrink-0 text-muted-foreground" />}
          {m.imageOutput && <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {m.id}
        </div>
      </div>
      <div className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
        {ctxLabel(m.ctx) && <div>{ctxLabel(m.ctx)} ctx</div>}
        <div>{priceLabel(m)}</div>
      </div>
      <CheckIcon
        className={cn("size-4 shrink-0", selected ? "opacity-100 text-primary" : "opacity-0")}
      />
    </CommandItem>
  )
}

export function ModelPicker({
  open,
  onOpenChange,
  value,
  onSelect,
  imageOnly = false,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: ModelRef | null
  onSelect: (ref: ModelRef, info: ModelInfo) => void
  imageOnly?: boolean
}) {
  const { openrouter, ollama, loading, errors, fetchedAt, refresh } = useModels()
  const hasOllamaKey = useSettings((s) => !!s.ollamaKey)
  const hasOpenrouterKey = useSettings((s) => !!s.openrouterKey)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const filter = (list: ModelInfo[]) =>
    imageOnly ? list.filter((m) => m.imageOutput) : list

  const groups: { name: string; models: ModelInfo[]; hasKey: boolean }[] = [
    { name: PROVIDER_NAMES.ollama, models: filter(ollama), hasKey: hasOllamaKey },
    { name: PROVIDER_NAMES.openrouter, models: filter(openrouter), hasKey: hasOpenrouterKey },
  ]

  const pick = (m: ModelInfo) => {
    onSelect({ provider: m.provider, model: m.id }, m)
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="!max-h-[92dvh] h-[92dvh]">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <DrawerTitle className="text-[15px] font-semibold">
            {imageOnly ? "Choose image model" : "Choose model"}
          </DrawerTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void refresh(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            {fetchedAt ? timeAgo(fetchedAt) : "refresh"}
          </Button>
        </div>
        <Command className="min-h-0 flex-1 bg-transparent">
          <div className="px-3 pb-2">
            <CommandInput placeholder="Search models…" />
          </div>
          <CommandList className="max-h-none min-h-0 flex-1 px-3 pb-safe">
            <CommandEmpty>No models found.</CommandEmpty>
            {groups.map((g) =>
              g.models.length ? (
                <CommandGroup key={g.name} heading={g.name}>
                  {g.models.map((m) => (
                    <ModelRow
                      key={`${m.provider}/${m.id}`}
                      m={m}
                      selected={
                        value?.provider === m.provider && value?.model === m.id
                      }
                      onSelect={() => pick(m)}
                    />
                  ))}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
        <div className="border-t border-border px-4 py-2.5 pb-safe text-[12px] text-muted-foreground">
          {!hasOllamaKey && !hasOpenrouterKey ? (
            <button
              className="flex items-center gap-1.5 text-primary"
              onClick={() => {
                onOpenChange(false)
                navigate("/settings")
              }}
            >
              <KeyIcon className="size-3.5" />
              Add an API key in Settings to get started
            </button>
          ) : errors.openrouter || errors.ollama ? (
            <span className="text-destructive">
              {errors.ollama ? `Ollama: ${errors.ollama}` : ""}
              {errors.ollama && errors.openrouter ? " · " : ""}
              {errors.openrouter ? `OpenRouter: ${errors.openrouter}` : ""}
            </span>
          ) : (
            <span>
              {groups.reduce((n, g) => n + g.models.length, 0)} models ·
              fetched live from providers
            </span>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
