export type SpeechFile = {path: string; bytes: number}

export type SpeechProgress = {message: string; percent?: number}

// A request carrying no samples loads the model and stops there.
export type SpeechRequest = {samples?: Float32Array}

export type SpeechResult = {type: "ready"} | {type: "transcript"; text: string}

export type SpeechResponse =
  | SpeechResult
  | ({type: "progress"} & SpeechProgress)
  | {type: "error"; message: string}
