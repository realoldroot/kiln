// Proves default app state and key-gated model fetching, in two phases:
//   1) brand-new profile, NO key: empty DB, no chats, and NO provider
//      requests at all — the model list stays empty with a key hint.
//   2) new profile WITH an OpenRouter key stored: the picker populates from
//      a LIVE fetch of the real OpenRouter /models API.
// The sandbox's egress proxy blocks Chromium's CONNECT tunnels (but not Node
// clients), so provider calls are relayed through Playwright's Node request
// context — still fetched live from the real API at run time.
import { chromium, request as pwRequest } from "playwright"
import { mkdirSync } from "node:fs"

mkdirSync("shots", { recursive: true })
const BASE = "http://localhost:4173"

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
})
const api = await pwRequest.newContext({
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY }
    : undefined,
  ignoreHTTPSErrors: true,
})

async function newPage(withKey) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  if (withKey) {
    await page.addInitScript(() => {
      localStorage.setItem(
        "amber-settings",
        JSON.stringify({
          version: 0,
          state: { openrouterKey: "sk-or-set-but-not-needed-for-model-list" },
        }),
      )
    })
  }
  const orRequests = []
  await page.route("**/openrouter.ai/**", async (route) => {
    orRequests.push(route.request().url())
    const res = await api.get(route.request().url(), { timeout: 30000 })
    await route.fulfill({
      status: res.status(),
      contentType: res.headers()["content-type"] ?? "application/json",
      body: await res.body(),
    })
  })
  return { ctx, page, orRequests }
}

const dumpState = (page) =>
  page.evaluate(async () => {
    const req = indexedDB.open("amber")
    const idb = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const count = (store) =>
      new Promise((res) => {
        try {
          const r = idb
            .transaction(store, "readonly")
            .objectStore(store)
            .count()
          r.onsuccess = () => res(r.result)
          r.onerror = () => res("err")
        } catch {
          res("missing")
        }
      })
    const settings = JSON.parse(
      localStorage.getItem("amber-settings") ?? "{}",
    ).state
    const cache = JSON.parse(localStorage.getItem("amber-models-cache") ?? "null")
    return {
      chats: await count("chats"),
      messages: await count("messages"),
      keysStored: {
        openrouter: !!settings?.openrouterKey,
        ollama: !!settings?.ollamaKey,
        tavily: !!settings?.tavilyKey,
      },
      skills: settings?.skills?.length ?? 0,
      cachedModels: cache
        ? { openrouter: cache.openrouter.length, ollama: cache.ollama.length }
        : null,
    }
  })

// ---------- phase 1: no key ----------
{
  const { ctx, page, orRequests } = await newPage(false)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  console.log("PHASE 1 (no key) boot state:", JSON.stringify(await dumpState(page)))
  await page.getByLabel("Open menu").click()
  await page.waitForTimeout(400)
  console.log("sidebar empty-state visible:", (await page.getByText("No chats yet").count()) > 0)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  await page.getByText("Choose model").click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: "shots/v1-nokey-picker.png" })
  console.log(
    "key hint shown:",
    (await page.getByText("Add an API key in Settings").count()) > 0,
  )
  console.log("provider requests made WITHOUT a key:", orRequests.length, orRequests)
  await ctx.close()
}

// ---------- phase 2: OpenRouter key stored ----------
{
  const { ctx, page, orRequests } = await newPage(true)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
  await page.getByText("Choose model").click()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: "shots/v2-key-live-models.png" })
  const live = await page.evaluate(() => {
    const cache = JSON.parse(localStorage.getItem("amber-models-cache") ?? "{}")
    const or = cache.openrouter ?? []
    return { count: or.length, sample: or.slice(0, 5).map((m) => m.id) }
  })
  console.log("PHASE 2 (key set) live models:", JSON.stringify(live))
  console.log("provider requests made WITH a key:", orRequests)
  await page.getByPlaceholder("Search models…").fill("claude")
  await page.waitForTimeout(600)
  await page.screenshot({ path: "shots/v3-key-live-search.png" })
  await ctx.close()
}

await api.dispose()
await browser.close()
console.log("VERIFY DONE")
