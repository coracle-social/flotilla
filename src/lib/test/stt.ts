import type {SttProgress, SttRequest, SttResult} from "@lib/stt/types"

type TestStt = {
  hasModel: () => Promise<boolean>
  run: (
    request: SttRequest,
    signal: AbortSignal,
    progress: (progress: SttProgress) => void,
  ) => Promise<SttResult>
}

export const getTestStt = () => (globalThis as {__TEST_STT__?: TestStt}).__TEST_STT__
