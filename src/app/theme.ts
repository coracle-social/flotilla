import twColors from "tailwindcss/colors"
import {derived, readable} from "svelte/store"
import {hash} from "@welshman/lib"
import {synced} from "@welshman/store"
import {FL_THEME} from "@app/env"
import {kv} from "@app/storage"

const colors = [
  twColors.amber[600],
  twColors.blue[600],
  twColors.cyan[600],
  twColors.emerald[600],
  twColors.fuchsia[600],
  twColors.green[600],
  twColors.indigo[600],
  twColors.sky[600],
  twColors.lime[600],
  twColors.orange[600],
  twColors.pink[600],
  twColors.purple[600],
  twColors.red[600],
  twColors.rose[600],
  twColors.sky[600],
  twColors.teal[600],
  twColors.violet[600],
  twColors.yellow[600],
  twColors.zinc[600],
]

export const colorFor = (value: string) => colors[hash(value) % colors.length]

// Every theme with token values in lib/components/theme.css
export const flThemes = ["clay", "flat", "navy"]

export const flTheme = synced({
  key: "flTheme",
  defaultValue: FL_THEME,
  storage: kv,
})

export const theme = synced({
  key: "theme",
  defaultValue: "system",
  storage: kv,
})

const prefersDark = readable(window.matchMedia("(prefers-color-scheme: dark)").matches, set => {
  const query = window.matchMedia("(prefers-color-scheme: dark)")
  const onChange = () => set(query.matches)

  query.addEventListener("change", onChange)

  return () => query.removeEventListener("change", onChange)
})

// What actually gets stamped on the document, since `theme` may defer to the os
export const activeTheme = derived([theme, prefersDark], ([$theme, $prefersDark]) => {
  if ($theme === "system") {
    return $prefersDark ? "dark" : "light"
  }

  return $theme
})
