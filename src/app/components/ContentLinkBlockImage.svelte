<script lang="ts">
  import {onMount, onDestroy} from "svelte"
  import {displayDomain, once} from "@welshman/lib"
  import {getBlob, makeBlossomAuthEvent, tagSpec, tagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import GalleryRemove from "@assets/icons/gallery-remove.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {decryptUrl, getUrlFileName, getUrlTags} from "@lib/media"
  import {user} from "@app/core/user"

  type Props = {
    url: string
    event: TrustedEvent
    class?: string
  }

  const {url, event, ...props}: Props = $props()

  const meta = getUrlTags(url, event)

  // Fall back to a blossom file name if the hash was omitted from the message for interoperability
  const hash = tagValue(tagSpec("x"), meta) || url.match(/\/([0-9a-f]{64})(\.\w+)?$/)?.[1]
  const controller = new AbortController()
  const fileName = getUrlFileName(url, event)

  const revokeSrc = () => {
    if (src.startsWith("blob:")) {
      URL.revokeObjectURL(src)
    }
  }

  const setBlobSrc = (data: Blob | Uint8Array<ArrayBuffer>, type?: string) => {
    revokeSrc()
    src = URL.createObjectURL(new File([data], fileName, type ? {type} : undefined))
  }

  const onError = once(async () => {
    // If the image failed to load, try authenticating
    if (hash) {
      try {
        const server = new URL(url).origin
        const template = makeBlossomAuthEvent({action: "get", server, hashes: [hash]})
        const authEvent = await $user.signer.sign(template)
        const res = await getBlob(server, hash, {authEvent})

        if (res.status === 200) {
          const blob = await res.blob()
          setBlobSrc(blob, blob.type || undefined)
        } else {
          status = res.status
          hasError = true
        }
      } catch (error) {
        console.error(error)
        hasError = true
      }
    } else {
      hasError = true
    }
  })

  let hasError = $state(false)
  let status = $state<number>()
  let src = $state("")

  onMount(async () => {
    try {
      src = await decryptUrl(url, event, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        hasError = true
      }
    }
  })

  onDestroy(() => {
    controller.abort()
    revokeSrc()
  })
</script>

{#if hasError}
  <div
    class="border border-solid flex max-w-xl items-center gap-3 rounded-2xl border-line bg-surface p-4 text-left">
    <Icon icon={GalleryRemove} size={6} class="shrink-0" />
    <div class="flex min-w-0 flex-col">
      <strong>Image unavailable</strong>
      <span class="text-sm text-content-muted">
        {#if status === 404}
          {displayDomain(url)} doesn't have this image. It may have been deleted.
        {:else if status === 401 || status === 403}
          {displayDomain(url)} didn't allow access to this image.
        {:else}
          This image couldn't be loaded from {displayDomain(url)}.
        {/if}
      </span>
    </div>
  </div>
{:else if src}
  <img alt="" {src} onerror={onError} {...props} />
{/if}
