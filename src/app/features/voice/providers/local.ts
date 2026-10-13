import {int, MINUTE} from "@welshman/lib"
import {decodeMono} from "@lib/audio"
import {hasLocalStt, transcribeLocally} from "@lib/stt"
import {sttModel} from "@lib/stt/models"
import LocalSttEnable from "@app/components/LocalSttEnable.svelte"
import {pushModal} from "@app/navigation/dialogs"
import type {VoiceEnable, VoiceProvider} from "@app/features/voice/providers/common"

// Generating speech on a phone is slower than playing it, so only stt runs here.
export const local: VoiceProvider = {
  ready: () => hasLocalStt(),
  enable: (_task, {onReady, onCancel, nested}: VoiceEnable) =>
    pushModal(LocalSttEnable, {onReady, onCancel}, {nested}),
  stt: async (audio: File, signal?: AbortSignal) => {
    const samples = await decodeMono(audio, sttModel.sampleRate)

    if (samples.length > sttModel.sampleRate * int(5, MINUTE)) {
      throw new Error(
        "Transcribe recordings up to five minutes long. You can still send this recording as a voice note.",
      )
    }

    return transcribeLocally(samples, signal)
  },
}
