export type VoiceTask = "stt" | "tts"

export type Stt = (audio: File, signal?: AbortSignal) => Promise<string>

export type Tts = (text: string, signal?: AbortSignal) => Promise<File>

/** A provider that cannot read a particular recording declines it, so the next one is asked. */
export class VoiceDeclined extends Error {}

// A provider serves the tasks it declares a method for, and declares nothing it cannot do.
export type VoiceProvider = {
  name: string
  // Whether this provider can serve the task on this device as it stands.
  ready: (task: VoiceTask) => Promise<boolean>
  stt?: Stt
  tts?: Tts
}

export type VoiceProviderFor<T extends VoiceTask> = VoiceProvider & Required<Pick<VoiceProvider, T>>

export type VoiceProviders = {
  runOrder: VoiceProvider[]
  setupOrder: VoiceProvider[]
}

const serves =
  <T extends VoiceTask>(task: T) =>
  (provider: VoiceProvider): provider is VoiceProviderFor<T> =>
    Boolean(provider[task])

// Every provider that can serve the task now, in the order to try them, and the one to set up first.
export const resolveVoiceProvider = async <T extends VoiceTask>(
  task: T,
  {runOrder, setupOrder}: VoiceProviders,
) => {
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
