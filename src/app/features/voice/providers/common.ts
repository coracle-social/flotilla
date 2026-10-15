export type VoiceTask = "stt" | "tts"

export type Stt = (audio: File, signal?: AbortSignal) => Promise<string>

export type Tts = (text: string, signal?: AbortSignal) => Promise<Blob>

export type VoiceEnable = {
  onReady: () => void
  onCancel?: () => void
  // Set where the prompt has to sit over a modal the caller already opened.
  nested?: boolean
}

/** A provider that cannot read a particular recording declines it, so the next one is asked. */
export class VoiceDeclined extends Error {}

// A provider serves the tasks it declares a method for, and declares nothing it cannot do.
export type VoiceProvider = {
  // Whether this provider can serve the task on this device as it stands.
  ready: (task: VoiceTask) => Promise<boolean>
  // Asks for whatever is missing, then hands control back.
  enable: (task: VoiceTask, options: VoiceEnable) => void
  stt?: Stt
  tts?: Tts
}

export type VoiceProviderFor<T extends VoiceTask> = VoiceProvider & Required<Pick<VoiceProvider, T>>
