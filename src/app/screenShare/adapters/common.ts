import type {LocalParticipant} from "livekit-client"

export type ScreenShareContext = {
  url: string
  h: string
  participant: LocalParticipant
}

export type ScreenShareSource = {
  id: string
  name: string
  type: "screen" | "window"
  thumbnail: string
}

/** Thrown when the OS or the browser refuses capture. The message is shown to the user. */
export class ScreenShareDenied extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ScreenShareDenied"
  }
}

export interface IScreenShareAdapter {
  isSupported: () => boolean
  start: (context: ScreenShareContext) => Promise<boolean>
  stop: (context: ScreenShareContext) => Promise<void>
  onStopped: (handler: () => void) => () => void
}

export const errorCode = (error: unknown) =>
  error instanceof Error && "code" in error ? String(error.code) : ""
