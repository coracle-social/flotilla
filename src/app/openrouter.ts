import type {Maybe} from "@welshman/lib"
import {getSetting} from "@app/settings"

// A successful response can be audio rather than json, so only a failure is read as json.
export const postOpenRouter = async (
  path: string,
  body: BodyInit,
  headers: Record<string, string> = {},
) => {
  const response = await fetch(`https://openrouter.ai/api/v1/${path}`, {
    method: "POST",
    headers: {Authorization: `Bearer ${getSetting("openrouter_key")}`, ...headers},
    body,
  })

  if (!response.ok) {
    const payload: Maybe<{error?: {message?: string}}> = await response
      .json()
      .catch(() => undefined)

    throw new Error(payload?.error?.message || `OpenRouter returned a ${response.status}.`)
  }

  return response
}
