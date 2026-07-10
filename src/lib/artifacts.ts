export type ArtifactType =
  | "text/markdown"
  | "text/html"
  | "application/code"
  | "image/svg+xml"

export interface ArtifactBlock {
  id: string
  type: ArtifactType
  title: string
  language?: string
  content: string
  complete: boolean
}

export type ContentSegment =
  | { kind: "text"; text: string }
  | { kind: "artifact"; artifact: ArtifactBlock }

const OPEN_RE = /<artifact\s+([^>]*?)>/
const FULL_RE = /<artifact\s+([^>]*?)>\r?\n?([\s\S]*?)\r?\n?<\/artifact>/

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of raw.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]] = m[2]
  return attrs
}

function normalizeType(t: string | undefined): ArtifactType {
  switch (t) {
    case "text/html":
      return "text/html"
    case "image/svg+xml":
      return "image/svg+xml"
    case "application/code":
      return "application/code"
    default:
      return "text/markdown"
  }
}

function makeBlock(
  attrRaw: string,
  content: string,
  complete: boolean,
  index: number,
): ArtifactBlock {
  const attrs = parseAttrs(attrRaw)
  return {
    id: attrs.identifier || `artifact-${index}`,
    type: normalizeType(attrs.type),
    title: attrs.title || "Untitled",
    language: attrs.language,
    content,
    complete,
  }
}

/**
 * Split raw assistant text into text/artifact segments.
 * Robust to a partially streamed artifact at the tail.
 */
export function splitContent(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  let rest = raw
  let index = 0

  while (rest) {
    const full = FULL_RE.exec(rest)
    if (full) {
      const before = rest.slice(0, full.index)
      if (before.trim()) segments.push({ kind: "text", text: before })
      segments.push({
        kind: "artifact",
        artifact: makeBlock(full[1], full[2], true, index++),
      })
      rest = rest.slice(full.index + full[0].length)
      continue
    }
    // Unclosed but fully-opened artifact tag (still streaming)
    const open = OPEN_RE.exec(rest)
    if (open) {
      const before = rest.slice(0, open.index)
      if (before.trim()) segments.push({ kind: "text", text: before })
      const partial = rest.slice(open.index + open[0].length)
      // Hide a trailing partial "</artifact" close tag while it streams in
      const content = partial.replace(/\r?\n?<\/?a?r?t?i?f?a?c?t?>?\s*$/, "")
      segments.push({
        kind: "artifact",
        artifact: makeBlock(open[1], content, false, index++),
      })
      return segments
    }
    // A partially streamed opening tag at the very end — hide it for now
    const partialOpen = rest.search(/<artifact\b[^>]*$/)
    if (partialOpen >= 0) {
      const before = rest.slice(0, partialOpen)
      if (before.trim()) segments.push({ kind: "text", text: before })
      return segments
    }
    segments.push({ kind: "text", text: rest })
    return segments
  }
  return segments
}

export function extractArtifacts(raw: string): ArtifactBlock[] {
  return splitContent(raw)
    .filter((s) => s.kind === "artifact")
    .map((s) => (s as { kind: "artifact"; artifact: ArtifactBlock }).artifact)
}

/** Content with artifact bodies removed (for title generation / previews). */
export function contentWithoutArtifacts(raw: string): string {
  return splitContent(raw)
    .map((s) => (s.kind === "text" ? s.text : `[Artifact: ${s.artifact.title}]`))
    .join("\n")
    .trim()
}

export function artifactExtension(a: ArtifactBlock): string {
  switch (a.type) {
    case "text/html":
      return "html"
    case "image/svg+xml":
      return "svg"
    case "application/code": {
      const map: Record<string, string> = {
        python: "py",
        javascript: "js",
        typescript: "ts",
        tsx: "tsx",
        jsx: "jsx",
        rust: "rs",
        ruby: "rb",
        kotlin: "kt",
        csharp: "cs",
        "c++": "cpp",
        shell: "sh",
        bash: "sh",
      }
      const lang = (a.language ?? "").toLowerCase()
      return map[lang] ?? (lang || "txt")
    }
    default:
      return "md"
  }
}
