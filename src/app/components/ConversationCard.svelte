<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {goToEvent} from "@app/routes"
  import {displayChannel} from "@app/state"

  type Props = {
    url: string
    room?: string
    events: TrustedEvent[]
    latest: TrustedEvent
    earliest: TrustedEvent
    participants: string[]
  }

  const {url, room, events, latest, earliest, participants}: Props = $props()
</script>

<Button class="card2 bg-alt" onclick={() => goToEvent(earliest)}>
  <div class="flex flex-col gap-3">
    <div class="flex items-start gap-3">
      <ProfileCircle pubkey={earliest.pubkey} size={10} />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 text-sm opacity-70">
          {#if room}
            <span class="font-medium text-blue-400">
              #{displayChannel(url, room)}
            </span>
            <span class="opacity-50">•</span>
          {/if}
          <span>{formatTimestamp(earliest.created_at)}</span>
        </div>
        <Content minimalQuote minLength={100} maxLength={400} event={earliest} />
      </div>
    </div>
    <div class="ml-13 flex items-center justify-between">
      <div class="flex gap-1">
        <Icon icon="alt-arrow-left" />
        <span class="text-sm opacity-70">
          {events.length}
          {events.length === 1 ? "message" : "messages"}
        </span>
      </div>
      <div class="flex gap-2">
        <ProfileCircles pubkeys={participants} size={6} />
        <span class="text-sm opacity-70">
          {participants.length}
          {participants.length === 1 ? "participant" : "participants"}
        </span>
      </div>
    </div>
    {#if latest !== earliest}
      <Button class="card2 bg-alt" onclick={() => goToEvent(latest)}>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm opacity-70">
              <ProfileCircle pubkey={latest.pubkey} size={5} />
              <span class="font-medium">Latest reply:</span>
            </div>
            <span class="text-xs opacity-50">
              {formatTimestamp(latest.created_at)}
            </span>
          </div>
          <Content minimalQuote minLength={100} maxLength={400} event={latest} />
        </div>
      </Button>
    {/if}
  </div>
</Button>
