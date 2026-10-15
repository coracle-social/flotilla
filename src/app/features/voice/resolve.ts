import {local} from "@app/features/voice/providers/local"
import {openrouter} from "@app/features/voice/providers/openrouter"
import type {VoiceProvider, VoiceProviderFor, VoiceTask} from "@app/features/voice/providers/common"

const runOrder: VoiceProvider[] = [local, openrouter]

const setupOrder: VoiceProvider[] = [openrouter, local]

const serves =
  <T extends VoiceTask>(task: T) =>
  (provider: VoiceProvider): provider is VoiceProviderFor<T> =>
    Boolean(provider[task])

// Every provider that can serve the task now, in the order to try them, and the one to set up first.
export const resolveVoiceProvider = async <T extends VoiceTask>(task: T) => {
  const candidates = await Promise.all(
    runOrder.filter(serves(task)).map(async provider => ({
      provider,
      ready: await provider.ready(task),
    })),
  )

  return {
    providers: candidates.filter(candidate => candidate.ready).map(candidate => candidate.provider),
    setup: setupOrder.filter(serves(task))[0],
  }
}
