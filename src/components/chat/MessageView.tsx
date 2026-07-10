import { memo, useState } from "react"
import {
  CheckIcon,
  CircleStopIcon,
  CopyIcon,
  FileIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { Message } from "@/lib/types"
import { splitContent, type ArtifactBlock } from "@/lib/artifacts"
import { cn } from "@/lib/utils"
import { useStream } from "@/stores/stream"
import { MarkdownView } from "./MarkdownView"
import { ReasoningBlock } from "./ReasoningBlock"
import { ToolStepView } from "./ToolStepView"
import { ArtifactCard } from "./ArtifactView"
import { Button } from "@/components/ui/button"

function ModelCaption({ msg }: { msg: Message }) {
  const name = msg.modelName ?? msg.model
  if (!name) return null
  return (
    <span className="truncate">
      {name}
      {msg.effort && msg.effort !== "auto" ? ` · ${msg.effort}` : ""}
    </span>
  )
}

export const MessageView = memo(function MessageView({
  msg,
  isLast,
  onRetry,
  onOpenArtifact,
}: {
  msg: Message
  isLast: boolean
  onRetry?: () => void
  onOpenArtifact: (a: ArtifactBlock) => void
}) {
  const live = useStream((s) => s.live[msg.id])
  const [copied, setCopied] = useState(false)

  if (msg.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5 px-4">
        {msg.attachments?.map((a) =>
          a.kind === "image" && a.dataUrl ? (
            <img
              key={a.id}
              src={a.dataUrl}
              alt={a.name}
              className="max-h-56 max-w-[75%] rounded-2xl border border-border object-cover"
            />
          ) : (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px]"
            >
              <FileIcon className="size-4 text-muted-foreground" />
              <span className="max-w-48 truncate">{a.name}</span>
            </div>
          ),
        )}
        {msg.content && (
          <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-bubble-user px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {msg.content}
          </div>
        )}
      </div>
    )
  }

  // assistant
  const content = live?.content ?? msg.content
  const reasoning = live?.reasoning ?? msg.reasoning ?? ""
  const steps = live?.steps ?? msg.steps ?? []
  const images = live?.images ?? msg.images ?? []
  const streaming = !!live
  const waiting = streaming && !content && !reasoning && !steps.length && !images.length
  const segments = splitContent(content)

  return (
    <div className="group px-4">
      {reasoning && (
        <ReasoningBlock
          reasoning={reasoning}
          reasoningMs={live?.reasoningMs ?? msg.reasoningMs}
          active={streaming && !content && !steps.some((s) => s.status !== "running")}
        />
      )}
      {steps.map((s) => (
        <ToolStepView key={s.id} step={s} />
      ))}
      {waiting && (
        <div className="flex items-center gap-2 py-1 text-[14px]">
          <span className="shimmer">Thinking…</span>
        </div>
      )}
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <MarkdownView key={i} content={seg.text} />
        ) : (
          <ArtifactCard
            key={`a-${i}`}
            artifact={seg.artifact}
            onOpen={() => onOpenArtifact(seg.artifact)}
          />
        ),
      )}
      {images.length > 0 && (
        <div className={cn("mt-2 grid gap-2", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((im) => (
            <a key={im.id} href={im.dataUrl} download={`amber-${im.id.slice(0, 6)}.png`}>
              <img
                src={im.dataUrl}
                alt="Generated"
                className="w-full rounded-2xl border border-border"
              />
            </a>
          ))}
        </div>
      )}
      {streaming && content && (
        <span className="ml-0.5 inline-block size-2.5 rounded-full bg-primary streaming-dot" />
      )}

      {msg.status === "error" && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Something went wrong</div>
            <div className="break-words opacity-90">{msg.error}</div>
          </div>
        </div>
      )}
      {msg.status === "interrupted" && (
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <TriangleAlertIcon className="size-3.5 text-primary" />
          Generation was interrupted (app was closed mid-stream)
        </div>
      )}
      {msg.status === "stopped" && (
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <CircleStopIcon className="size-3.5" /> Stopped
        </div>
      )}

      {!streaming && (
        <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <ModelCaption msg={msg} />
          <div className="ml-auto flex items-center opacity-70 transition-opacity group-hover:opacity-100">
            {(content || reasoning) && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy message"
                onClick={() => {
                  void navigator.clipboard.writeText(content)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            )}
            {isLast && onRetry && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Regenerate"
                onClick={onRetry}
              >
                <RefreshCwIcon />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
