<script module lang="ts">
  import {postJson, simpleCache} from "@welshman/lib"
  import {dufflepud} from "@app/env"

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
  import {call, ellipsize, displayUrl} from "@welshman/lib"
  import {isRelayUrl, tagSpec, tagValue} from "@welshman/util"
  import {Capacitor} from "@capacitor/core"
  import {preventDefault, stopPropagation} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ContentLinkDetail from "@app/components/ContentLinkDetail.svelte"
  import ContentLinkUrl from "@app/components/ContentLinkUrl.svelte"
  import ContentLinkBlockImage from "@app/components/ContentLinkBlockImage.svelte"
  import {pushModal} from "@app/modal"
  import {PLATFORM_URL, THUMBNAIL_URL} from "@app/env"
  import {AUDIO_CONTENT_TYPES, IMAGE_CONTENT_TYPES, VIDEO_CONTENT_TYPES} from "@app/content"
  import {isRoomId} from "@app/rooms"

  const {value, event} = $props()

  let hideImage = $state(false)

  const url = value.url.toString()
  const isRoomOrRelay = isRoomId(url) || isRelayUrl(url)
  const [href, external] = call(() => {
    if (url.startsWith(PLATFORM_URL)) return [url.replace(PLATFORM_URL, ""), false]

    return [url, true]
  })

  const fileType = tagValue(tagSpec("file-type"), event.tags) || ""

  const isAudio =
    Boolean(url.match(/\.(mp3|m4a|wav|ogg|oga|opus|flac)$/)) ||
    AUDIO_CONTENT_TYPES.includes(fileType)

  const getVideoPoster = (videoUrl: string): string | undefined => {
    if (Capacitor.getPlatform() === "android" && THUMBNAIL_URL) {
      return `${THUMBNAIL_URL}/thumbnail?url=${encodeURIComponent(videoUrl)}`
    }

    return undefined
  }

  const onError = () => {
    hideImage = true
  }

  const expand = () => pushModal(ContentLinkDetail, {value, event}, {fullscreen: true})
</script>

{#if isRoomOrRelay}
  <ContentLinkUrl {url} class="link-content whitespace-nowrap" />
{:else if isAudio}
  <audio controls src={url} preload="metadata" class="my-2 w-full max-w-xl"></audio>
{:else}
  <Link {external} {href} class="my-2 block">
    {#if url.match(/\.(mov|webm|mp4)$/) || VIDEO_CONTENT_TYPES.includes(fileType)}
      <video
        controls
        src={url}
        poster={getVideoPoster(url)}
        preload="metadata"
        class="max-h-96 rounded-2xl object-contain object-center">
        <track kind="captions" />
      </video>
    {:else if url.match(/\.(jpe?g|png|gif|webp)$/) || IMAGE_CONTENT_TYPES.includes(fileType)}
      <button type="button" onclick={stopPropagation(preventDefault(expand))}>
        <ContentLinkBlockImage {value} {event} class="m-auto max-h-96 rounded-2xl" />
      </button>
    {:else}
      {#await loadPreview(url)}
        <div class="flex justify-center items-center my-12 w-full">
          <Spinner />
        </div>
      {:then preview}
        <div
          class="border border-solid flex max-w-xl flex-col overflow-hidden leading-normal rounded-2xl"
          style="border-color: var(--line)">
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
      {:catch}
        <p
          class="border border-solid p-12 text-center leading-normal rounded-2xl"
          style="border-color: var(--line)">
          Unable to load a preview for {url}
        </p>
      {/await}
    {/if}
  </Link>
{/if}
