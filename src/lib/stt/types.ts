export type SttFile = {url: string; bytes: number}

export type SttProgress = {message: string; percent?: number}

// A request carrying no samples loads the model and stops there.
export type SttRequest = {samples?: Float32Array}

/**
 * confidence is the mean of the transcript's per-word probabilities, which is what tells a language
 * the model reads from one it guesses at. A transcript with no words in it has no confidence.
 */
export type SttTranscript = {
  type: "transcript"
  text: string
  language: string
  confidence: number
}

export type SttResult = {type: "ready"} | SttTranscript

export type SttResponse =
  | SttResult
  | ({type: "progress"} & SttProgress)
  | {type: "error"; message: string}
