<script lang="ts">
  import type {Snippet} from "svelte"
  import {LOCALE, formatTimestampAsTime, now, secondsToDate} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {user} from "@app/core"

  type Props = {
    path: string
    event: TrustedEvent
    url?: string
    icon: Snippet
    title: Snippet
    subtitle: Snippet
  }

  const {path, event, url, icon, title, subtitle}: Props = $props()

  const shortDate = (ts: number) =>
    Intl.DateTimeFormat(LOCALE, {dateStyle: "short"}).format(secondsToDate(ts))

  const timestamp = $derived(
    shortDate(event.created_at) === shortDate(now())
      ? formatTimestampAsTime(event.created_at)
      : shortDate(event.created_at),
  )
</script>

<Link href={path} class="card card-sm card-interactive flex items-center gap-3">
  {@render icon()}
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <div class="flex min-w-0 items-center gap-2 text-sm">
      <strong class="truncate">{@render title()}</strong>
      <span class="min-w-0 flex-1 truncate opacity-50">{@render subtitle()}</span>
      <span class="shrink-0 text-xs opacity-50">{timestamp}</span>
      <UnreadDot {path} class="shrink-0" />
    </div>
    <div class="flex min-w-0 items-center gap-1 text-sm opacity-75">
      <div class="flex max-w-1/2 shrink-0 items-center">
        <span class="truncate">
          {#if event.pubkey === $user.pubkey}
            You
          {:else}
            <ProfileName pubkey={event.pubkey} {url} />
          {/if}
        </span>
        <span>:</span>
      </div>
      <div class="min-w-0 flex-1">
        <NoteContentMinimal {event} {url} singleLine />
      </div>
    </div>
  </div>
</Link>
