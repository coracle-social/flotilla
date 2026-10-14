import {local} from "@app/features/voice/providers/local"
import {openrouter} from "@app/features/voice/providers/openrouter"
import type {VoiceProvider, VoiceProviderFor, VoiceTask} from "@app/features/voice/providers/common"

const runOrder: VoiceProvider[] = [local, openrouter]

const setupOrder: VoiceProvider[] = [openrouter, local]

const serves =
  <T extends VoiceTask>(task: T) =>
  (provider: VoiceProvider): provider is VoiceProviderFor<T> =>
    Boolean(provider[task])

// The provider a task runs on, and whether it can run now or has to be set up first.
export const resolveVoiceProvider = async <T extends VoiceTask>(task: T) => {
  const candidates = await Promise.all(
    runOrder.filter(serves(task)).map(async provider => ({
      provider,
      ready: await provider.ready(task),
    })),
  )

  return (
    candidates.find(candidate => candidate.ready) ?? {
      provider: setupOrder.filter(serves(task))[0],
      ready: false,
    }
  )
}
