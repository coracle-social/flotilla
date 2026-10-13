export type SttFile = {path: string; bytes: number}

export type SttProgress = {message: string; percent?: number}

// A request carrying no samples loads the model and stops there.
export type SttRequest = {samples?: Float32Array}

export type SttResult = {type: "ready"} | {type: "transcript"; text: string}

export type SttResponse =
  | SttResult
  | ({type: "progress"} & SttProgress)
  | {type: "error"; message: string}
