import {hasLocalSpeech, transcribeLocally} from "@lib/speech"
import LocalSpeechEnable from "@app/components/LocalSpeechEnable.svelte"
import {pushModal} from "@app/modal"
import type {InferenceEnable, InferenceProvider} from "@app/inference/adapters/common"

// Generating speech on a phone is slower than playing it, so only transcription runs here.
export const local: InferenceProvider = {
  ready: () => hasLocalSpeech(),
  enable: (_task, {onReady, onCancel, nested}: InferenceEnable) =>
    pushModal(LocalSpeechEnable, {onReady, onCancel}, {nested}),
  transcribe: transcribeLocally,
}
