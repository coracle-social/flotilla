<script lang="ts">
  import {tagSpec, tagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import FileDownload from "@assets/icons/file-download.svg?dataurl"
  import Paperclip from "@assets/icons/paperclip.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {downloadBlob, preventDefault, stopPropagation} from "@lib/html"
  import {fetchUrlBlob, getUrlFileName, getUrlTags} from "@lib/media"
  import {formatBytes} from "@lib/util"
  import {pushToast} from "@app/features/toast"

  type Props = {
    url: string
    event: TrustedEvent
    inline?: boolean
    class?: string
  }

  const {url, event, inline = false, class: className = ""}: Props = $props()

  const name = getUrlFileName(url, event)
  const size = Number(tagValue(tagSpec("size"), getUrlTags(url, event)))

  const download = async () => {
    loading = true

    try {
      await downloadBlob(name, await fetchUrlBlob(url, event))
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: `${name} could not be downloaded.`})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<!-- Use a real link so people can copy the href -->
{#if inline}
  <a href={url} onclick={stopPropagation(preventDefault(download))} class={className}>
    <Icon icon={Paperclip} size={3} class="inline-block" />
    {name}
  </a>
{:else}
  <a
    href={url}
    onclick={stopPropagation(preventDefault(download))}
    class="border border-solid my-2 flex max-w-xl items-center gap-3 rounded-2xl border-line p-4">
    {#if loading}
      <Spinner />
    {:else}
      <Icon icon={FileDownload} size={6} />
    {/if}
    <div class="flex min-w-0 flex-col">
      <strong class="overflow-hidden text-ellipsis whitespace-nowrap">{name}</strong>
      {#if size}
        <span class="text-sm text-content-muted">{formatBytes(size)}</span>
      {/if}
    </div>
  </a>
{/if}
