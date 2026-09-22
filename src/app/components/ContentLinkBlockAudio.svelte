<script lang="ts">
  import {onDestroy} from "svelte"
  import {tagSpec, tagValue} from "@welshman/util"
  import {displayUrl} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {decryptUrl, getUrlTags} from "@app/content"

  type Props = {url: string; event: TrustedEvent}

  const {url, event}: Props = $props()
  const meta = getUrlTags(url, event)
  const algorithm = tagValue(tagSpec("encryption-algorithm"), meta)
  const controller = new AbortController()

  let source = $state<string>(algorithm ? "" : url)
  let failed = $state(false)
  let loading = $state(false)

  const load = async () => {
    loading = true

    try {
      source = await decryptUrl(url, event, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        failed = true
      }
    } finally {
      loading = false
    }
  }

  const onError = () => {
    failed = true
  }

  onDestroy(() => {
    controller.abort()
    if (source?.startsWith("blob:")) {
      URL.revokeObjectURL(source)
    }
  })
</script>

{#if failed}
  <a href={url} class="link-content whitespace-nowrap">{displayUrl(url)}</a>
{:else if source}
  <audio controls src={source} preload="metadata" class="my-2 w-full max-w-xl" onerror={onError}
  ></audio>
{:else}
  <Button class="button button-link my-2" disabled={loading} onclick={load}>
    <Spinner {loading}>Load audio</Spinner>
  </Button>
{/if}
