<script lang="ts">
  import {stopPropagation} from "svelte/legacy"
  import {PublishStatus} from "@welshman/net"
  import type {Publishable} from "@welshman/app"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RelayLabel from "@app/components/RelayLabel.svelte"
  import {HIDE_NOSTR} from "@app/core/env"

  type Props = {
    publication: Publishable
    retry: (url: string) => void
  }

  const {publication, retry}: Props = $props()

  const successUrls = $derived($publication.getUrlsWithStatus(PublishStatus.Success))
  const failedUrls = $derived($publication.getFailedUrls())
  const total = $derived(successUrls.length + failedUrls.length)
  const isPartial = $derived(successUrls.length > 0 && failedUrls.length > 0)

  const retryUrl = (url: string) => () => retry(url)

  const relayMessage = (status: PublishStatus | undefined, detail: string | undefined) => {
    if (status === PublishStatus.Timeout) {
      return "request timed out."
    }

    if (detail) {
      return `${detail}.`.replace(/\.+$/, ".")
    }

    return "no details received."
  }
</script>

<div class="card flex min-w-72 max-w-sm flex-col gap-3 px-4 py-3">
  <span class="flex items-center gap-2 text-sm font-medium">
    <Icon icon={Danger} class="text-error" size={4} />
    {#if isPartial && !HIDE_NOSTR}
      Partial delivery {successUrls.length}/{total} relays
    {:else}
      Failed to send!
    {/if}
  </span>
  <div class="divider my-0"></div>
  <div class="flex flex-col gap-3">
    {#if !HIDE_NOSTR}
      {#each successUrls as url (url)}
        <div class="flex items-start gap-2 text-sm">
          <Icon icon={CheckCircle} class="mt-0.5 shrink-0 text-success" size={4} />
          <RelayLabel {url} />
        </div>
      {/each}
    {/if}
    {#each failedUrls as url (url)}
      {@const {detail, status} = $publication.results[url] || {}}
      <div class="grid grid-cols-[1rem_1fr_auto] items-start gap-x-3 gap-y-1 text-sm">
        <Icon icon={Danger} class="mt-0.5 text-error" size={4} />
        <div class="min-w-0">
          <RelayLabel {url} class="break-all" />
          <p class="text-xs opacity-60">{relayMessage(status, detail)}</p>
        </div>
        <Button class="button button-link shrink-0 px-1" onclick={stopPropagation(retryUrl(url))}>
          Retry
        </Button>
      </div>
    {/each}
  </div>
</div>
