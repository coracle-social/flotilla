import {sleep, randomId} from "@welshman/lib"
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
      const {scrollHeight, scrollTop, clientHeight} = container
      const viewHeight = clientHeight || innerHeight
      const offset = Math.abs(scrollTop || scrollY)
      const shouldLoad = reverse
        ? offset < threshold
        : offset + viewHeight + threshold > scrollHeight

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
      success: result => resolve(result as File),
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
