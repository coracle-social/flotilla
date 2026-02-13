<script lang="ts">
  import {call, displayUrl} from "@welshman/lib"
  import {isRelayUrl, getTagValue} from "@welshman/util"
  import {preventDefault, stopPropagation} from "@lib/html"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import ContentLinkDetail from "@app/components/ContentLinkDetail.svelte"
  import {pushModal} from "@app/util/modal"
  import {PLATFORM_URL, IMAGE_CONTENT_TYPES} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"

  const {value, event} = $props()

  const url = value.url.toString()
  const fileType = getTagValue("file-type", event.tags) || ""
  const [href, external] = call(() => {
    if (isRelayUrl(url)) return [makeSpacePath(url), false]
    if (url.startsWith(PLATFORM_URL)) return [url.replace(PLATFORM_URL, ""), false]

    return [url, true]
  })

  const expand = () => pushModal(ContentLinkDetail, {value, event}, {fullscreen: true})
</script>

{#if url.match(/\.(jpe?g|png|gif|webp)$/) || IMAGE_CONTENT_TYPES.includes(fileType)}
  <!-- Use a real link so people can copy the href -->
  <a
    href={url}
    class="link-content whitespace-nowrap"
    onclick={stopPropagation(preventDefault(expand))}>
    <Icon icon={LinkRound} size={3} class="inline-block" />
    {displayUrl(url)}
  </a>
{:else}
  <Link {external} {href} class="link-content whitespace-nowrap">
    <Icon icon={LinkRound} size={3} class="inline-block" />
    {displayUrl(url)}
  </Link>
{/if}
