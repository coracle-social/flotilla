import {derived, writable} from "svelte/store"

export enum VideoCallLayout {
  Chat = "chat",
  Video = "video",
  Split = "split",
}

export const videoCallLayout = writable<VideoCallLayout>(VideoCallLayout.Split)

// Seen shares live here, not in the component, so a remount does not re-steal the spotlight.
type VideoSpotlight = {
  liveShareKeys: string[]
  primaryKey: string | undefined
}

const noSpotlight: VideoSpotlight = {liveShareKeys: [], primaryKey: undefined}

const videoSpotlight = writable<VideoSpotlight>(noSpotlight)

export const videoPrimaryTileKey = derived(videoSpotlight, $s => $s.primaryKey)

export const resetVideoCallLayout = () => {
  videoCallLayout.set(VideoCallLayout.Chat)
}

export const resetVideoSpotlight = () => {
  videoSpotlight.set(noSpotlight)
}

export const toggleVideoPrimaryTile = (key: string) => {
  videoSpotlight.update(s => ({...s, primaryKey: s.primaryKey === key ? undefined : key}))
}

export const syncVideoSpotlight = (tileKeys: string[], shareKeys: string[]) => {
  videoSpotlight.update(({liveShareKeys, primaryKey}) => {
    const started = shareKeys.filter(k => !liveShareKeys.includes(k))
    const live = [...liveShareKeys.filter(k => shareKeys.includes(k)), ...started]
    const spotlightLost = primaryKey !== undefined && !tileKeys.includes(primaryKey)

    return {
      liveShareKeys: live,
      primaryKey: started.length > 0 || spotlightLost ? live.at(-1) : primaryKey,
    }
  })
}
