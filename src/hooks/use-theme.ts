import { useEffect } from "react"
import { useSettings } from "@/stores/settings"

export function useApplyTheme() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches)
      document.documentElement.classList.toggle("dark", dark)
      const meta = document.querySelector(
        'meta[name="theme-color"]:not([media])',
      )
      const color = dark ? "#262624" : "#faf9f5"
      if (meta) meta.setAttribute("content", color)
      else {
        const m = document.createElement("meta")
        m.name = "theme-color"
        m.content = color
        document.head.appendChild(m)
      }
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [theme])
}

export function useIsDark(): boolean {
  const theme = useSettings((s) => s.theme)
  if (theme === "system")
    return typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  return theme === "dark"
}
