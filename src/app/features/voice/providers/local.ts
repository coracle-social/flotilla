import {int, MINUTE} from "@welshman/lib"
import {decodeMono} from "@lib/audio"
import {hasLocalStt, transcribeLocally} from "@lib/stt"
import {sttModel} from "@lib/stt/models"
import LocalSttEnable from "@app/components/LocalSttEnable.svelte"
import {pushModal} from "@app/navigation/dialogs"
import {VoiceDeclined} from "@app/features/voice/providers/common"
import type {VoiceEnable, VoiceProvider} from "@app/features/voice/providers/common"

/**
 * The model answers a language it does not read as fluent nonsense in one it does, and the mean
 * word probability separates the two: measured over 78 clips of read and spontaneous speech,
 * in-language transcripts have a median of 0.91 and out-of-language ones 0.63. This cut keeps 34
 * of the 36 in-language transcripts and refuses 40 of the 42 out-of-language ones.
 */
const minimumConfidence = 0.76

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

    const {text, confidence} = await transcribeLocally(samples, signal)

    if (text && confidence < minimumConfidence) {
      throw new VoiceDeclined(
        `This device reads ${sttModel.languages}. Add an OpenRouter key in Content Settings to transcribe anything else.`,
      )
    }

    return text
  },
}
