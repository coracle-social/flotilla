import twColors from "tailwindcss/colors"
import {debounce} from "throttle-debounce"
import {derived, get, readable} from "svelte/store"
import {call, hash} from "@welshman/lib"
import {synced} from "@welshman/store"
import {FL_THEME} from "@app/core/env"
import {kv} from "@app/core/storage"
import {userSettingsValues} from "@app/core/settings"

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
export const flThemes = ["clay", "flat", "navy", "nature"]

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

// The stores syncTheme mirrors load well after first paint, so stamp their last values first.
export const applySavedTheme = () => {
  const savedTheme = localStorage.getItem("theme")
  const initialTheme =
    savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : get(prefersDark)
        ? "dark"
        : "light"

  document.documentElement.style.fontSize = `${localStorage.getItem("font-size") || 1.1}rem`
  document.documentElement.style.colorScheme = initialTheme
  document.body.setAttribute("data-fl-theme", localStorage.getItem("fl-theme") || FL_THEME)
  document.body.setAttribute("data-theme", initialTheme)
}

export const syncTheme = () => {
  const unsubscribers = [
    activeTheme.subscribe($activeTheme => {
      localStorage.setItem("theme", $activeTheme)
      document.body.setAttribute("data-theme", $activeTheme)
      document.documentElement.style.colorScheme = $activeTheme
    }),
    flTheme.subscribe($flTheme => {
      localStorage.setItem("fl-theme", $flTheme)
      document.body.setAttribute("data-fl-theme", $flTheme)
    }),
    userSettingsValues.subscribe(
      debounce(100, $settings => {
        localStorage.setItem("font-size", String($settings.font_size))
        document.documentElement.style.fontSize = `${$settings.font_size}rem`
      }),
    ),
  ]

  return () => unsubscribers.forEach(call)
}
