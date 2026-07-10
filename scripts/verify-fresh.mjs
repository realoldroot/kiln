// Proves the default app state: a brand-new profile, NO seed param.
// Expects: empty IndexedDB, no chats in the sidebar, and the model picker
// populated by a LIVE fetch from the real OpenRouter API (no hardcoded list).
// Routes the browser through the sandbox's egress proxy so the real
// openrouter.ai is reachable from headless Chromium.
import { chromium, request as pwRequest } from "playwright"
import { mkdirSync } from "node:fs"

mkdirSync("shots", { recursive: true })
const BASE = "http://localhost:4173"

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

// The sandbox's egress proxy blocks Chromium's CONNECT tunnels (but not
// Node clients), so relay the app's OpenRouter calls through Playwright's
// Node-side request context. The response is still fetched LIVE from the
// real API at run time — nothing is stubbed. On a normal network the
// browser calls OpenRouter directly (CORS: access-control-allow-origin: *).
const api = await pwRequest.newContext({
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  ignoreHTTPSErrors: true,
})
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

await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)

// 1) storage state on first boot
const state = await page.evaluate(async () => {
  const req = indexedDB.open("amber")
  const idb = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const count = (store) =>
    new Promise((res) => {
      try {
        const r = idb.transaction(store, "readonly").objectStore(store).count()
        r.onsuccess = () => res(r.result)
        r.onerror = () => res("err")
      } catch {
        res("missing")
      }
    })
  const settingsRaw = localStorage.getItem("amber-settings")
  const settings = settingsRaw ? JSON.parse(settingsRaw).state : null
  const cacheRaw = localStorage.getItem("amber-models-cache")
  const cache = cacheRaw ? JSON.parse(cacheRaw) : null
  return {
    chats: await count("chats"),
    messages: await count("messages"),
    keysStored: {
      openrouter: !!settings?.openrouterKey,
      ollama: !!settings?.ollamaKey,
      tavily: !!settings?.tavilyKey,
    },
    skills: settings?.skills?.length ?? 0,
    modelsCache: cache
      ? { openrouter: cache.openrouter.length, ollama: cache.ollama.length }
      : null,
  }
})
console.log("FRESH BOOT STATE:", JSON.stringify(state, null, 1))

await page.screenshot({ path: "shots/v1-fresh-home.png" })

// 2) sidebar is empty
await page.getByLabel("Open menu").click()
await page.waitForTimeout(500)
await page.screenshot({ path: "shots/v2-fresh-sidebar.png" })
const emptyMsg = await page.getByText("No chats yet").count()
console.log("sidebar empty-state visible:", emptyMsg > 0)
await page.keyboard.press("Escape")
await page.waitForTimeout(400)

// 3) model picker fetches LIVE from openrouter.ai
await page.getByText("Choose model").click()
await page.waitForTimeout(4000) // allow the live fetch to complete
await page.screenshot({ path: "shots/v3-live-models.png" })
const footer = await page
  .locator("text=/\\d+ models · fetched live/")
  .textContent()
  .catch(() => "not found")
console.log("picker footer:", footer)

// count rendered model rows + sample some real ids from the live list
const live = await page.evaluate(() => {
  const cache = JSON.parse(localStorage.getItem("amber-models-cache") ?? "{}")
  const or = cache.openrouter ?? []
  return {
    count: or.length,
    sample: or.slice(0, 6).map((m) => m.id),
    hasPricing: or.filter((m) => m.pricing).length,
  }
})
console.log("LIVE OPENROUTER MODELS:", JSON.stringify(live, null, 1))
console.log("openrouter.ai requests made by the app:", orRequests)

// search works over the live list
await page.getByPlaceholder("Search models…").fill("claude")
await page.waitForTimeout(600)
await page.screenshot({ path: "shots/v4-live-models-search.png" })

await api.dispose()
await browser.close()
console.log("VERIFY DONE")
