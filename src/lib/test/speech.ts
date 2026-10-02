import type {SpeechProgress, SpeechRequest, SpeechResult} from "@lib/speech/types"

type TestSpeech = {
  hasModel: () => Promise<boolean>
  run: (
    request: SpeechRequest,
    signal: AbortSignal,
    progress: (progress: SpeechProgress) => void,
  ) => Promise<SpeechResult>
}

export const getTestSpeech = () => (globalThis as {__TEST_SPEECH__?: TestSpeech}).__TEST_SPEECH__
