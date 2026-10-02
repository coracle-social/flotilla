import type {BrowserContext} from "@playwright/test"

type Request = {check?: boolean; samples?: number}
type Result = {ready?: boolean; text?: string}

/** The local transcription model, answering every recording with the same transcript. */
export const mockLocalSpeech = async (
  context: BrowserContext,
  {text = ""}: {text?: string} = {},
) => {
  // How many samples each recording decoded to, so a spec can tell one happened at all.
  const recordings: number[] = []
  let downloaded = false
  let held: Promise<void> | undefined
  let release: (() => void) | undefined
  let failure: string | undefined

  await context.exposeFunction("__localSpeech", async (request: Request): Promise<Result> => {
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

    return request.samples ? {text} : {ready: true}
  })

  const install = () => {
    const host = globalThis as typeof globalThis & {
      __localSpeech: (request: Request) => Promise<Result>
    }
    Object.assign(globalThis, {
      __TEST_SPEECH__: {
        hasModel: async () => (await host.__localSpeech({check: true})).ready,
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
            host.__localSpeech({samples: request.samples?.length}).then(resolve, reject)
          })

          return result.text === undefined
            ? {type: "ready"}
            : {type: "transcript", text: result.text}
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
