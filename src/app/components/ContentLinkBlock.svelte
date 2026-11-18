<script module lang="ts">
  import {postJson, simpleCache} from "@welshman/lib"
  import {dufflepud} from "@app/core/env"

  // Cache previews by url so the same link isn't re-fetched across renders/instances.
  const loadPreview = simpleCache(async ([url]: [string]) => {
    const json = await postJson(dufflepud("link/preview"), {url})

    if (!json?.title && !json?.image) {
      throw new Error("Failed to load link preview")
    }

    return json
  })
</script>

<script lang="ts">
  import {call, ellipsize, displayUrl, noop} from "@welshman/lib"
  import {isRelayUrl} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {Capacitor} from "@capacitor/core"
  import {preventDefault, stopPropagation} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Maximize from "@assets/icons/maximize.svg?dataurl"
  import {getUrlContentType, isAudioUrl, isImageUrl, isVideoUrl} from "@lib/media"
  import Link from "@app/components/Link.svelte"
  import ContentLinkDetail from "@app/components/ContentLinkDetail.svelte"
  import ContentLinkVideo from "@app/components/ContentLinkVideo.svelte"
  import ContentLinkBlockAudio from "@app/components/ContentLinkBlockAudio.svelte"
  import ContentLinkUrl from "@app/components/ContentLinkUrl.svelte"
  import ContentLinkBlockImage from "@app/components/ContentLinkBlockImage.svelte"
  import ContentLinkFile from "@app/components/ContentLinkFile.svelte"
  import {pushModal} from "@app/navigation/dialogs"
  import {PLATFORM_URL, THUMBNAIL_URL} from "@app/core/env"
  import {isRoomId} from "@app/areas/spaces/rooms"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  let hideImage = $state(false)

  const isRoomOrRelay = isRoomId(url) || isRelayUrl(url)
  const [href, external] = call(() => {
    if (url.startsWith(PLATFORM_URL)) {
      return [url.replace(PLATFORM_URL, ""), false]
    }

    return [url, true]
  })

  const fileType = getUrlContentType(url, event)

  const isAudio = isAudioUrl(url, event)

  const isVideo = isVideoUrl(url, event)

  const isImage = isImageUrl(url, event)

  const getVideoPoster = (videoUrl: string): string | undefined => {
    if (Capacitor.getPlatform() === "android" && THUMBNAIL_URL) {
      return `${THUMBNAIL_URL}/thumbnail?url=${encodeURIComponent(videoUrl)}`
    }

    return undefined
  }

  const onError = () => {
    hideImage = true
  }

  const expand = () =>
    pushModal(ContentLinkDetail, {url, event}, {fullscreen: true, label: "Content preview"})
</script>

{#if isRoomOrRelay}
  <ContentLinkUrl {url} class="link-content" />
{:else if isAudio}
  <ContentLinkBlockAudio {url} {event} />
{:else if isVideo}
  <!-- The card underneath opens the note, which a click on the player must not reach -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="relative my-2 inline-block" onclick={stopPropagation(noop)}>
    <ContentLinkVideo
      {url}
      {event}
      controls
      poster={getVideoPoster(url)}
      class="max-h-96 rounded-2xl object-contain object-center" />
    <Button
      aria-label="Open video"
      class="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white"
      onclick={stopPropagation(preventDefault(expand))}>
      <Icon icon={Maximize} size={4} />
    </Button>
  </div>
{:else if isImage}
  <Link {external} {href} class="my-2 block">
    <button type="button" onclick={stopPropagation(preventDefault(expand))}>
      <ContentLinkBlockImage {url} {event} class="m-auto max-h-96 rounded-2xl" />
    </button>
  </Link>
{:else if fileType}
  <ContentLinkFile {url} {event} />
{:else}
  {#await loadPreview(url)}
    <Link {external} {href} class="my-2 block">
      <div
        class="border border-solid flex max-w-xl flex-col overflow-hidden leading-normal rounded-2xl border-line">
        <div class="flex flex-col gap-2 p-4">
          <Spinner>
            <span class="overflow-hidden text-ellipsis whitespace-nowrap">{displayUrl(url)}</span>
          </Spinner>
        </div>
      </div>
    </Link>
  {:then preview}
    <Link {external} {href} class="my-2 block">
      <div
        class="border border-solid flex max-w-xl flex-col overflow-hidden leading-normal rounded-2xl border-line">
        {#if preview.image && !hideImage}
          <img
            alt=""
            onerror={onError}
            src={preview.image}
            class="bg-surface max-h-72 object-contain object-center" />
        {/if}
        <div class="flex flex-col gap-2 p-4">
          <strong class="overflow-hidden text-ellipsis whitespace-nowrap"
            >{preview.title || displayUrl(url)}</strong>
          <p>{ellipsize(preview.description, 140)}</p>
        </div>
      </div>
    </Link>
  {:catch}
    <ContentLinkUrl {url} class="link-content whitespace-normal wrap-anywhere" />
  {/await}
{/if}
