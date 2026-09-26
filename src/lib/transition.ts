import {cubicOut} from "svelte/easing"
import type {FlyParams, SlideParams} from "svelte/transition"
import {fly as baseFly} from "svelte/transition"

export {fade, slide} from "svelte/transition"

export const fly = (node: Element, params?: FlyParams | undefined) =>
  baseFly(node, {y: 20, ...params})

export type TranslateParams = {
  delay?: number
  duration?: number
  easing?: (t: number) => number
  axis?: "x" | "y"
  offset?: number
  unit?: string
}

export const translate = (
  node: Element,
  {
    delay = 0,
    duration = 400,
    easing = cubicOut,
    axis = "y",
    offset = 100,
    unit = "%",
  }: TranslateParams = {},
) => {
  return {
    delay,
    duration,
    easing,
    css: (t: number) => {
      const p = `${offset - t * offset}${unit}`

      if (axis === "x") {
        return `transform: translateX(${p})`
      } else {
        return `transform: translateY(${p})`
      }
    },
  }
}

export const slideAndFade = (
  node: Element,
  {delay = 0, duration = 400, easing = cubicOut, axis = "y"}: SlideParams = {},
) => {
  const style = getComputedStyle(node)
  const [start, end] = axis === "y" ? ["top", "bottom"] : ["left", "right"]
  const sizes = [
    axis === "y" ? "height" : "width",
    `padding-${start}`,
    `padding-${end}`,
    `margin-${start}`,
    `margin-${end}`,
    `border-${start}-width`,
    `border-${end}-width`,
  ].map((property): [string, number] => [property, parseFloat(style.getPropertyValue(property))])

  return {
    delay,
    duration,
    easing,
    css: (t: number) =>
      `overflow: hidden;opacity: ${t};` +
      sizes.map(([property, size]) => `${property}: ${t * size}px;`).join(""),
  }
}
