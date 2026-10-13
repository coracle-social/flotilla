export type InferenceTask = "synthesize" | "transcribe"

export type Synthesize = (text: string, signal?: AbortSignal) => Promise<Blob>

export type Transcribe = (audio: File, signal?: AbortSignal) => Promise<string>

export type InferenceEnable = {
  onReady: () => void
  onCancel?: () => void
  // Set where the prompt has to sit over a modal the caller already opened.
  nested?: boolean
}

// A provider serves the tasks it declares a method for, and declares nothing it cannot do.
export type InferenceProvider = {
  // Whether this provider can serve the task on this device as it stands.
  ready: (task: InferenceTask) => Promise<boolean>
  // Asks for whatever is missing, then hands control back.
  enable: (task: InferenceTask, options: InferenceEnable) => void
  synthesize?: Synthesize
  transcribe?: Transcribe
}

export type InferenceProviderFor<T extends InferenceTask> = InferenceProvider &
  Required<Pick<InferenceProvider, T>>
