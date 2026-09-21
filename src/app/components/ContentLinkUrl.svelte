<script lang="ts">
  import {call, displayUrl} from "@welshman/lib"
  import {displayRelayUrl, isRelayUrl, normalizeRelayUrl} from "@welshman/util"
  import {splitRoomKey} from "@welshman/app"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {PLATFORM_URL} from "@app/env"
  import {isRoomId} from "@app/rooms"
  import {makeRoomPath, makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    class?: string
  }

  const {url, class: className = ""}: Props = $props()

  const roomReference = call(() => {
    if (!isRoomId(url)) {
      return undefined
    }

    const [roomUrl, h] = splitRoomKey(url)

    if (!roomUrl || !h || !isRelayUrl(roomUrl)) {
      return undefined
    }

    return {url: normalizeRelayUrl(roomUrl), h}
  })

  const relayReference = call(() => {
    if (roomReference || !isRelayUrl(url)) {
      return undefined
    }

    return normalizeRelayUrl(url)
  })

  const [href, external] = call(() => {
    if (roomReference) {
      return [makeRoomPath(roomReference.url, roomReference.h), false]
    }
    if (relayReference) {
      return [makeSpacePath(relayReference), false]
    }
    if (url.startsWith(PLATFORM_URL)) {
      return [url.replace(PLATFORM_URL, ""), false]
    }

    return [url, true]
  })
</script>

<Link {external} {href} class={className}>
  {#if roomReference}
    #<RoomName {...roomReference} />
  {:else if relayReference}
    <span class="text-primary">{displayRelayUrl(relayReference)}</span>
  {:else}
    <Icon icon={LinkRound} size={3} class="inline-block" />
    {displayUrl(url)}
  {/if}
</Link>
