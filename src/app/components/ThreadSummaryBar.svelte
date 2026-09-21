<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  type Props = {
    url: string
    event: TrustedEvent
    onClick: () => void
  }

  const {url, event, onClick}: Props = $props()

  const title = tagValue(tagSpec("title"), event.tags)
</script>

<Button
  onclick={onClick}
  aria-label="Back to the top of the thread"
  class="bg-surface flex w-full items-center gap-3 border-b px-4 py-2 shadow-md"
  style="border-color: var(--line)">
  <ProfileCircle pubkey={event.pubkey} {url} size={8} class="shrink-0" />
  <div class="flex min-w-0 flex-col">
    <span class="truncate text-sm font-bold">{title || "Untitled thread"}</span>
    <div class="min-w-0 text-xs opacity-75">
      <ContentMinimal {event} {url} singleLine />
    </div>
  </div>
</Button>
