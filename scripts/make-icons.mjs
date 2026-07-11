// Renders public/icons/icon.svg to the PNG sizes the manifest needs,
// using the pre-installed Chromium via Playwright.
import { chromium } from "playwright"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const svg = readFileSync(resolve("public/icons/icon.svg"), "utf8")

// maskable: shrink artwork into the safe zone on a solid background
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#c96442"/>
  <g transform="translate(51.2,51.2) scale(0.8)">${svg
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "")}</g>
</svg>`

// apple-touch-icon: iOS wants an opaque, full-bleed square (it applies the
// rounded-corner mask itself; transparent corners get composited on black).
const appleSvg = svg.replace('rx="116"', 'rx="0"')

const targets = [
  { file: "public/icons/icon-192.png", size: 192, svg },
  { file: "public/icons/icon-512.png", size: 512, svg },
  { file: "public/icons/icon-512-maskable.png", size: 512, svg: maskableSvg },
  // Served from the site root: iOS falls back to /apple-touch-icon.png when
  // it ignores the <link> tag (a long-standing Safari quirk), so the file
  // must live there, not in /icons/.
  { file: "public/apple-touch-icon.png", size: 180, svg: appleSvg },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
})
const page = await browser.newPage()
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(
    `<style>*{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(
      t.svg,
    ).toString("base64")}" width="${t.size}" height="${t.size}">`,
  )
  const buf = await page.screenshot({ omitBackground: true })
  writeFileSync(resolve(t.file), buf)
  console.log("wrote", t.file)
}
await browser.close()
