import {readable} from "svelte/store"
import {simpleCache} from "@welshman/lib"
import {getHttpAuthHeader} from "@app/core/signer"

// A relay that hosts calls answers at a well-known path with a token for each room.
const livekitUrl = (url: string) =>
  url.replace(/^ws/, "http").replace(/\/$/, "") + "/.well-known/nip29/livekit"

export const deriveHasLivekit = simpleCache(([url]: [string]) =>
  readable<boolean | undefined>(undefined, set => {
    fetch(livekitUrl(url)).then(
      response => set(response.status === 204),
      () => set(false),
    )
  }),
)

export const fetchLivekitToken = async (
  url: string,
  roomId: string,
  signal?: AbortSignal,
): Promise<{server_url: string; participant_token: string}> => {
  const endpoint = `${livekitUrl(url)}/${roomId}`

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  const response = await fetch(endpoint, {
    headers: {Authorization: await getHttpAuthHeader(endpoint)},
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token request failed (${response.status}): ${text}`)
  }

  return response.json()
}
