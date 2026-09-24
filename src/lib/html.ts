import {readable} from "svelte/store"
import {sleep, randomId} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
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

// Fixed positioning so an @svelte-plugins/datepicker popup escapes scroll-container clipping.
export const anchorDatepicker = (wrapper: HTMLElement) => {
  const reposition = () => {
    const anchor = wrapper.querySelector("label")
    const container = wrapper.querySelector(".calendars-container") as HTMLElement | null

    if (!anchor || !container) {
      return
    }

    const margin = 8
    const rect = anchor.getBoundingClientRect()
    const height = container.offsetHeight
    const width = container.offsetWidth

    let top = rect.bottom + 4

    // flip above the input when there's not enough room below, else pin to the bottom edge
    if (height && top + height > innerHeight - margin) {
      top =
        rect.top - height - 4 >= margin
          ? rect.top - height - 4
          : Math.max(margin, innerHeight - height - margin)
    }

    const left = width
      ? Math.max(margin, Math.min(rect.left, innerWidth - width - margin))
      : rect.left

    wrapper.style.setProperty("--datepicker-container-position", "fixed")
    wrapper.style.setProperty("--datepicker-container-top", `${top}px`)
    wrapper.style.setProperty("--datepicker-container-left", `${left}px`)
  }

  reposition()
  addEventListener("scroll", reposition, true)
  addEventListener("resize", reposition)

  return () => {
    removeEventListener("scroll", reposition, true)
    removeEventListener("resize", reposition)
  }
}

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

export const isMobile = "ontouchstart" in document.documentElement

// Cached because a couple of popovers per chat row runs this thousands of times.
let tippyTarget: Maybe<Element>

export const getTippyTarget = (trigger?: Element) => {
  const dialogTarget = trigger?.closest(".dialog-overlay")?.querySelector(".dialog-tippy-target")

  if (dialogTarget) {
    return dialogTarget
  }

  if (!tippyTarget?.isConnected) {
    tippyTarget = document.querySelector(".tippy-target")!
  }

  return tippyTarget
}

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

export const isIntersecting = async (element: Element) =>
  new Promise(resolve => {
    const observer = new IntersectionObserver(xs => {
      resolve(xs.some(x => x.isIntersecting))
      observer.unobserve(element)
    })

    observer.observe(element)
  })

export const compressFile = async (
  file: File | Blob,
  options: Record<string, any> = {},
): Promise<File> => {
  const {default: Compressor} = await import("compressorjs-next")

  return new Promise<File>((resolve, _reject) => {
    new Compressor(file, {
      maxWidth: 2048,
      maxHeight: 2048,
      convertTypes: ["image/png"],
      ...options,
      success: result => {
        // Capacitor's fetch interceptor checks instanceof File, and canvas.toBlob returns a Blob.
        const f =
          result instanceof File
            ? result
            : new File([result], (result as any).name || (file as any).name || "upload", {
                type: result.type,
              })
        resolve(f)
      },
      error: e => {
        // Non-images break compressor, return the original file
        if (e.toString().includes("File or Blob")) {
          if (file instanceof Blob) {
            file = new File([file], `${randomId()}.${file.type}`, {type: file.type})
          }

          return resolve(file as File)
        }

        _reject(e)
      },
    })
  })
}

export const escapeHtml = (html: string) => {
  const element = document.createElement("div")

  element.innerText = html

  return element.innerHTML
}
