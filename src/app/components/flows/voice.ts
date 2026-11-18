import type {VoiceProvider, VoiceTask} from "@lib/audio/voice"
import LocalSttEnable from "@app/components/LocalSttEnable.svelte"
import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
import {pushModal} from "@app/navigation/dialogs"

// Opens the provider's setup prompt, and resolves true once the provider is ready.
export const setupVoice = (task: VoiceTask, provider: VoiceProvider, {nested = false} = {}) =>
  new Promise<boolean>(resolve => {
    const onReady = () => resolve(true)
    const onCancel = () => resolve(false)

    if (provider.name === "local") {
      pushModal(LocalSttEnable, {onReady, onCancel}, {nested})
    } else if (task === "stt") {
      pushModal(
        OpenRouterEnable,
        {
          feature: "Voice input",
          subtitle: "Say what you want to write and have it typed for you.",
          onReady,
          onCancel,
        },
        {nested},
      )
    } else {
      pushModal(
        OpenRouterEnable,
        {
          feature: "Read out loud",
          subtitle: "Have a message read to you instead of reading it yourself.",
          onReady,
          onCancel,
        },
        {nested},
      )
    }
  })
