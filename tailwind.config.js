import {config} from "dotenv"
import daisyui from "daisyui"
import themes from "daisyui/src/theming/themes"

config({path: ".env"})
config({path: ".env.template"})

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  safelist: ["bg-success", "bg-warning"],
  theme: {
    extend: {},
    zIndex: {
      none: 0,
      "nav-active": 1,
      "nav-item": 2,
      feature: 3,
      compose: 4,
      nav: 5,
      popover: 6,
      modal: 7,
      "modal-feature": 8,
      toast: 9,
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        dark: {
          ...themes["dark"],
          primary: process.env.VITE_PLATFORM_ACCENT,
          "primary-content": process.env.VITE_PLATFORM_ACCENT_CONTENT || "#EAE7FF",
          secondary: process.env.VITE_PLATFORM_SECONDARY,
          "secondary-content": process.env.VITE_PLATFORM_SECONDARY_CONTENT || "#EAE7FF",
        },
        light: {
          ...themes["winter"],
          neutral: "#F2F7FF",
          warning: "#FD8D0B",
          primary: process.env.VITE_PLATFORM_ACCENT,
          "primary-content": process.env.VITE_PLATFORM_ACCENT_CONTENT || "#EAE7FF",
          secondary: process.env.VITE_PLATFORM_SECONDARY,
          "secondary-content": process.env.VITE_PLATFORM_SECONDARY_CONTENT || "#EAE7FF",
        },
      },
    ],
  },
}
