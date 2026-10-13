import {local} from "@app/features/inference/adapters/local"
import {openrouter} from "@app/features/inference/adapters/openrouter"
import type {
  InferenceProvider,
  InferenceProviderFor,
  InferenceTask,
} from "@app/features/inference/adapters/common"

export type {
  InferenceProvider,
  InferenceProviderFor,
  InferenceTask,
  Synthesize,
  Transcribe,
} from "@app/features/inference/adapters/common"

const runOrder: InferenceProvider[] = [local, openrouter]
const setupOrder: InferenceProvider[] = [openrouter, local]

const serves =
  <T extends InferenceTask>(task: T) =>
  (provider: InferenceProvider): provider is InferenceProviderFor<T> =>
    Boolean(provider[task])

// The provider a task runs on, and whether it can run now or has to be set up first.
export const resolveInference = async <T extends InferenceTask>(task: T) => {
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
