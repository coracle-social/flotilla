import type {BrowserContext} from "@playwright/test"

type Request = {check?: boolean; samples?: number}
type Result = {ready?: boolean; text?: string; confidence?: number}

/** The local transcription model, answering every recording with the same transcript. */
export const mockLocalStt = async (
  context: BrowserContext,
  {text = "", confidence = 1}: {text?: string; confidence?: number} = {},
) => {
  // How many samples each recording decoded to, so a spec can tell one happened at all.
  const recordings: number[] = []
  let downloaded = false
  let held: Promise<void> | undefined
  let release: (() => void) | undefined
  let failure: string | undefined

  await context.exposeFunction("__localStt", async (request: Request): Promise<Result> => {
    if (request.check) {
      return {ready: downloaded}
    }
    if (failure) {
      const message = failure
      failure = undefined
      throw new Error(message)
    }
    if (request.samples) {
      recordings.push(request.samples)
    }
    await held
    downloaded = true

    return request.samples ? {text, confidence} : {ready: true}
  })

  const install = () => {
    const host = globalThis as typeof globalThis & {
      __localStt: (request: Request) => Promise<Result>
    }
    Object.assign(globalThis, {
      __TEST_STT__: {
        hasModel: async () => (await host.__localStt({check: true})).ready,
        run: async (
          request: {samples?: Float32Array},
          signal: AbortSignal,
          progress: (progress: {message: string; percent?: number}) => void,
        ) => {
          progress({message: "Downloading model…", percent: 40})
          const result = await new Promise<Result>((resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              {once: true},
            )
            host.__localStt({samples: request.samples?.length}).then(resolve, reject)
          })

          return result.text === undefined
            ? {type: "ready"}
            : {
                type: "transcript",
                text: result.text,
                language: "en",
                confidence: result.confidence ?? 1,
              }
        },
      },
    })
  }
  await context.addInitScript(install)
  for (const page of context.pages()) {
    await page.evaluate(install)
  }

  return {
    recordings,
    setTranscript: (value: string) => {
      text = value
    },
    // How sure the model is of the transcript, which is what decides whether it is used at all.
    setConfidence: (value: number) => {
      confidence = value
    },
    failNext: (message: string) => {
      failure = message
    },
    hold: () => {
      held = new Promise<void>(resolve => {
        release = resolve
      })
    },
    release: () => {
      release?.()
      held = undefined
    },
  }
}
