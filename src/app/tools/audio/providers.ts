import {sttModel} from "@lib/stt/models"
import type {VoiceProviders} from "@lib/audio/voice"
import {makeLocalProvider} from "@lib/audio/providers/local"
import {makeOpenRouterProvider} from "@lib/audio/providers/openrouter"
import {ENABLE_LOCAL_STT} from "@app/core/env"
import {getSetting} from "@app/core/settings"

const local = makeLocalProvider({
  declinedMessage: `This device reads ${sttModel.languages}. Add an OpenRouter key in Content Settings to transcribe anything else.`,
})

const openrouter = makeOpenRouterProvider({getKey: () => getSetting("openrouter_key")})

export const voiceProviders: VoiceProviders = ENABLE_LOCAL_STT
  ? {runOrder: [local, openrouter], setupOrder: [openrouter, local]}
  : {runOrder: [openrouter], setupOrder: [openrouter]}
