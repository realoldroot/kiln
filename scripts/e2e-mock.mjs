// End-to-end smoke test: drives the real UI against a mocked OpenRouter +
// Tavily backend. Verifies streaming, the tool loop, artifact parsing,
// persistence and title generation. Needs `npm run preview` on :4173.
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"

const BASE = "http://localhost:4173"
mkdirSync("shots", { recursive: true })

const sse = (events) =>
  events.map((e) => `data: ${JSON.stringify(e)}`).join("\n\n") +
  "\n\ndata: [DONE]\n\n"

const chunk = (delta, finish = null) => ({
  id: "gen-1",
  choices: [{ delta, finish_reason: finish }],
})

// Round 1: model asks for a web search
const round1 = sse([
  chunk({ role: "assistant", content: "" }),
  chunk({
    tool_calls: [
      {
        index: 0,
        id: "call_1",
        function: { name: "web_search", arguments: '{"query":"best esp' },
      },
    ],
  }),
  chunk({
    tool_calls: [{ index: 0, function: { arguments: 'resso beans 2026"}' } }],
  }),
  chunk({}, "tool_calls"),
])

// Round 2: reasoning + prose + a markdown artifact
const round2 = sse([
  chunk({ reasoning: "The search results mention three roasters. " }),
  chunk({ reasoning: "I'll summarise and produce a short guide artifact." }),
  chunk({ content: "Based on what I found, here's a quick guide:\n\n" }),
  chunk({
    content:
      '<artifact identifier="espresso-guide" type="text/markdown" title="Espresso beans — quick guide">\n# Espresso beans\n\n',
  }),
  chunk({ content: "- **Fresh roast date** beats brand\n- Medium-dark for milk drinks\n" }),
  chunk({ content: "</artifact>\n\nWant tasting notes for any of these?" }),
  chunk({}, "stop"),
])

// Title call
const titleResp = sse([chunk({ content: "Espresso bean picks" }), chunk({}, "stop")])

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
})
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()

// keys + a models cache so the composer is ready without hitting the network
await page.addInitScript(() => {
  const models = {
    fetchedAt: Date.now(),
    ollama: [],
    openrouter: [
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        provider: "openrouter",
        ctx: 1000000,
        vision: true,
        reasoning: true,
        tools: true,
        pricing: { prompt: 3, completion: 15 },
      },
    ],
  }
  localStorage.setItem("amber-models-cache", JSON.stringify(models))
  localStorage.setItem(
    "amber-settings",
    JSON.stringify({
      version: 0,
      state: {
        openrouterKey: "sk-or-test",
        tavilyKey: "tvly-test",
        lastModel: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
        webSearchEnabled: true,
        webFetchEnabled: true,
        generateTitles: true,
      },
    }),
  )
})

let orCalls = 0
const bodies = []
await page.route("**/openrouter.ai/api/v1/chat/completions", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}")
  bodies.push(body)
  orCalls++
  const isTitle = body.messages?.[0]?.content?.includes("short titles")
  const hasToolResult = body.messages?.some((m) => m.role === "tool")
  const payload = isTitle ? titleResp : hasToolResult ? round2 : round1
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream" },
    body: payload,
  })
})
await page.route("**/api.tavily.com/search", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      answer: "Fresh roast dates matter more than brand.",
      results: [
        { title: "Espresso guide", url: "https://example.com/g", content: "Roasters A, B, C lead 2026 rankings." },
      ],
    }),
  }),
)

const errors = []
page.on("pageerror", (e) => errors.push(e.message))

await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
await page.getByPlaceholder("Message Amber…").fill("What espresso beans should I buy?")
await page.getByLabel("Send").click()

// tool chip appears
await page.getByText("Searched “best espresso beans 2026”").waitFor({ timeout: 10000 })
// artifact card appears
await page.getByText("Espresso beans — quick guide").waitFor({ timeout: 10000 })
// generated title lands in the header
await page.getByRole("heading", { name: "Espresso bean picks" }).waitFor({ timeout: 10000 })
await page.waitForTimeout(400)
await page.screenshot({ path: "shots/e2e-stream-result.png" })

// artifact viewer opens with rendered markdown
await page.getByText("Espresso beans — quick guide").click()
await page.getByRole("tab", { name: "Source" }).waitFor({ timeout: 5000 })
await page.screenshot({ path: "shots/e2e-artifact-open.png" })
await page.keyboard.press("Escape")

// persisted? reload and check the message + steps survive
await page.reload({ waitUntil: "networkidle" })
await page.getByText("Searched “best espresso beans 2026”").waitFor({ timeout: 10000 })
await page.getByText("Espresso beans — quick guide").waitFor({ timeout: 5000 })
await page.getByText(/Thought for/).waitFor({ timeout: 5000 })

// request shape checks
const first = bodies[0]
const assertTrue = (cond, msg) => {
  if (!cond) {
    console.error("ASSERT FAIL:", msg)
    process.exitCode = 1
  } else console.log("ok:", msg)
}
assertTrue(first.model === "anthropic/claude-sonnet-4.5", "model id sent")
assertTrue(first.stream === true, "stream requested")
assertTrue(first.messages[0].role === "system", "system prompt first")
assertTrue(
  first.tools?.some((t) => t.function.name === "web_search"),
  "web_search tool advertised",
)
const second = bodies.find((b) => b.messages?.some((m) => m.role === "tool"))
assertTrue(!!second, "tool result round-tripped")
assertTrue(
  second?.messages?.some((m) => m.tool_calls?.length),
  "assistant tool_calls echoed back",
)
assertTrue(orCalls >= 3, `made ${orCalls} provider calls (incl. title)`)
assertTrue(errors.length === 0, `no page errors (${errors.join("; ") || "none"})`)

await browser.close()
console.log(process.exitCode ? "E2E FAILED" : "E2E PASSED")
