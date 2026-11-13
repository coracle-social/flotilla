import {noop} from "@welshman/lib"
import {Capacitor, registerPlugin} from "@capacitor/core"

type AudioPlaybackPlugin = {
  start(): Promise<void>
  stop(): Promise<void>
}

const AudioPlayback = registerPlugin<AudioPlaybackPlugin>("AudioPlayback")

// Android freezes an app that leaves the foreground, so a foreground service holds it up while a media element plays.
export const setupAudioPlayback = () => {
  if (Capacitor.getPlatform() === "android") {
    const playing = new Set<HTMLMediaElement>()

    const onPlay = (event: Event) => {
      const element = event.target

      if (element instanceof HTMLMediaElement && !playing.has(element)) {
        const controller = new AbortController()

        const onStop = () => {
          controller.abort()
          playing.delete(element)

          if (playing.size === 0) {
            AudioPlayback.stop().catch(console.error)
          }
        }

        if (playing.size === 0) {
          AudioPlayback.start().catch(console.error)
        }

        playing.add(element)

        // An element taken off the page or emptied of its stream stops where the document can't hear it.
        element.addEventListener("pause", onStop, {signal: controller.signal})
        element.addEventListener("emptied", onStop, {signal: controller.signal})
      }
    }

    // Media events don't bubble, so the document catches them on the way down.
    document.addEventListener("play", onPlay, true)

    return () => {
      document.removeEventListener("play", onPlay, true)
      AudioPlayback.stop().catch(console.error)
    }
  }

  return noop
}
