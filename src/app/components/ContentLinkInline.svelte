<script lang="ts">
  import cx from "classnames"
  import {displayUrl} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {preventDefault, stopPropagation} from "@lib/html"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentLinkDetail from "@app/components/ContentLinkDetail.svelte"
  import ContentLinkUrl from "@app/components/ContentLinkUrl.svelte"
  import {pushModal} from "@app/modal"
  import {getUrlContentType, IMAGE_CONTENT_TYPES} from "@app/content"

  type Props = {
    url: string
    event: TrustedEvent
    singleLine?: boolean
  }

  const {url, event, singleLine = false}: Props = $props()

  const className = cx("link-content", {"whitespace-normal wrap-anywhere": !singleLine})

  const fileType = getUrlContentType(url, event)

  const expand = () =>
    pushModal(ContentLinkDetail, {url, event}, {fullscreen: true, label: "Content preview"})
</script>

{#if url.match(/\.(jpe?g|png|gif|webp)$/) || IMAGE_CONTENT_TYPES.includes(fileType)}
  <!-- Use a real link so people can copy the href -->
  <a href={url} class={className} onclick={stopPropagation(preventDefault(expand))}>
    <Icon icon={LinkRound} size={3} class="inline-block" />
    {displayUrl(url)}
  </a>
{:else}
  <ContentLinkUrl {url} class={className} />
{/if}
