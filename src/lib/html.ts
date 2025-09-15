import {sleep, last} from "@welshman/lib"
export {preventDefault, stopPropagation} from "svelte/legacy"

export const copyToClipboard = (text: string) => {
  const {activeElement} = document
  const input = document.createElement("textarea")

  input.innerHTML = text
  document.body.appendChild(input)
  input.select()

  const result = document.execCommand("copy")

  document.body.removeChild(input)
  ;(activeElement as HTMLElement).focus()

  return result
}

export type ScrollerOpts = {
  onScroll: () => any
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
    if (container) {
      // While we have empty space, fill it
      const {scrollY, innerHeight} = window
      const {scrollHeight, scrollTop} = container
      const offset = Math.abs(scrollTop || scrollY)
      const shouldLoad = offset + innerHeight + threshold > scrollHeight

      // Only trigger loading the first time we reach the threshold
      if (shouldLoad) {
        await onScroll()
      }
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

export const downloadText = (filename: string, text: string) => {
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

export const scrollToEvent = async (id: string, attempts = 3): Promise<boolean> => {
  const element = document.querySelector(`[data-event="${id}"]`) as any
  const elements = Array.from(document.querySelectorAll("[data-event]"))

  if (element) {
    element.scrollIntoView({behavior: "smooth", block: "center"})
    element.style = "filter: brightness(1.5); transition-property: all; transition-duration: 400ms;"

    setTimeout(() => {
      element.style = "transition-property: all; transition-duration: 300ms;"
    }, 800)

    setTimeout(() => {
      element.style = ""
    }, 800 + 400)

    return true
  } else if (elements.length > 0) {
    const lastElement = last(elements)

    if (lastElement && !isIntersecting(lastElement)) {
      lastElement.scrollIntoView({behavior: "smooth", block: "center"})
    }

    await sleep(300)

    if (attempts > 0) {
      return scrollToEvent(id, attempts - 1)
    } else {
      return false
    }
  }

  return false
}

export const stripExifData = async (file, {maxWidth = null, maxHeight = null} = {}) => {
  if (window.DataTransferItem && file instanceof DataTransferItem) {
    file = file.getAsFile()
  }

  if (!file) {
    return file
  }

  const {default: Compressor} = await import("compressorjs")

  /* eslint no-new: 0 */

  return new Promise((resolve, _reject) => {
    new Compressor(file, {
      maxWidth: maxWidth || 2048,
      maxHeight: maxHeight || 2048,
      convertSize: 10 * 1024 * 1024,
      success: resolve,
      error: e => {
        // Non-images break compressor
        if (e.toString().includes("File or Blob")) {
          return resolve(file)
        }

        _reject(e)
      },
    })
  })
}
