import {readable} from "svelte/store"
import {sleep} from "@welshman/lib"
import {Capacitor} from "@capacitor/core"
export {preventDefault, stopPropagation} from "svelte/legacy"

/** Whether the tab is visible and focused, since `document.hidden` alone misses window blur. */
export const documentActive = readable(
  typeof document === "undefined" ? true : !document.hidden && document.hasFocus(),
  set => {
    if (typeof document === "undefined") {
      return
    }

    const update = () => set(!document.hidden && document.hasFocus())

    document.addEventListener("visibilitychange", update)
    window.addEventListener("blur", update)
    window.addEventListener("focus", update)

    return () => {
      document.removeEventListener("visibilitychange", update)
      window.removeEventListener("blur", update)
      window.removeEventListener("focus", update)
    }
  },
)

export const copyToClipboard = (text: string) => {
  const {activeElement} = document
  const input = document.createElement("textarea")
  const target = activeElement?.closest(".dialog-overlay") || document.body

  input.innerHTML = text
  target.appendChild(input)
  input.select()

  const result = document.execCommand("copy")

  target.removeChild(input)

  if (activeElement instanceof HTMLElement) {
    activeElement.focus()
  }

  return result
}

export type ScrollerOpts = {
  onScroll: () => any
  // Called when a check decides nothing more is wanted, rather than between requests.
  onSettle?: () => any
  element: Element
  threshold?: number
  reverse?: boolean
  delay?: number
}

export type Scroller = {
  check: () => Promise<void>
  stop: () => void
}

export const createScroller = ({
  onScroll,
  onSettle,
  element,
  delay = 1000,
  threshold = 2000,
  reverse = false,
}: ScrollerOpts) => {
  let done = false

  const container = element.classList.contains("scroll-container")
    ? element
    : element.closest(".scroll-container")

  const check = async () => {
    const isHidden = (el: Element) => !(el as HTMLElement).offsetParent || el.clientHeight === 0

    // A throw here skips the rAF below and ends scrolling for the life of the component.
    try {
      if (container && !isHidden(container)) {
        // While we have empty space, fill it
        const {scrollY, innerHeight} = window
        const {scrollHeight, scrollTop, clientHeight} = container
        const viewHeight = clientHeight || innerHeight
        const offset = Math.abs(scrollTop || scrollY)
        const shouldLoad = reverse
          ? offset < threshold
          : offset + viewHeight + threshold > scrollHeight

        // Only trigger loading the first time we reach the threshold
        if (shouldLoad) {
          await onScroll()
        } else {
          onSettle?.()
        }
      }
    } catch (error) {
      console.error(error)
    }

    // No need to check all that often
    await sleep(delay)

    if (!done) {
      requestAnimationFrame(check)
    }
  }

  requestAnimationFrame(check)

  return {
    check,
    stop: () => {
      done = true
    },
  }
}

export const isMobile = document.documentElement.ontouchstart !== undefined

export const downloadText = async (filename: string, text: string) => {
  // The <a download> blob trick is a no-op in native WebViews, so write the file and share it.
  if (["android", "ios"].includes(Capacitor.getPlatform())) {
    const {Filesystem, Directory, Encoding} = await import("@capacitor/filesystem")
    const {Share} = await import("@capacitor/share")

    const {uri} = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })

    await Share.share({title: filename, files: [uri]})

    return
  }

  const blob = new Blob([text], {type: "text/plain"})
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")

  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const escapeHtml = (html: string) => {
  const element = document.createElement("div")

  element.innerText = html

  return element.innerHTML
}
