import { chromium, request as pwRequest } from "playwright"

// A) Node-side APIRequestContext through the proxy
try {
  const api = await pwRequest.newContext({
    proxy: { server: process.env.HTTPS_PROXY },
    ignoreHTTPSErrors: true,
  })
  const res = await api.get("https://openrouter.ai/api/v1/models", { timeout: 20000 })
  const j = await res.json()
  console.log("A) node request ctx:", res.status(), "models:", j.data?.length)
  await api.dispose()
} catch (e) { console.log("A) failed:", String(e).slice(0, 200)) }

// B) Chromium page.goto through proxy
try {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost" },
  })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const resp = await page.goto("https://openrouter.ai/api/v1/models", { timeout: 20000 })
  console.log("B) chromium goto:", resp?.status())
  await browser.close()
} catch (e) { console.log("B) failed:", String(e).slice(0, 200)) }
