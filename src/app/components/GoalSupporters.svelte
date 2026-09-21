<script lang="ts">
  import {formatTimestampRelative, groupBy, max, sortBy, sum} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {fromMsats} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Crown from "@assets/icons/crown.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import {ENABLE_ZAPS} from "@app/env"
  import type {GoalProgress} from "@app/goals"

  type Props = {
    url: string
    event: TrustedEvent
    progress: GoalProgress
  }

  const {url, event, progress}: Props = $props()

  const supporters = $derived(
    sortBy(
      supporter => -supporter.amount,
      Array.from(groupBy(zap => zap.request.pubkey, progress.zaps)).map(([pubkey, zaps]) => ({
        pubkey,
        amount: fromMsats(sum(zaps.map(zap => zap.invoiceAmount))),
        comment: zaps.map(zap => zap.request.content.trim()).find(content => content),
        zappedAt: max(zaps.map(zap => zap.response.created_at)),
      })),
    ),
  )

  const topAmount = $derived(max(supporters.map(supporter => supporter.amount)))

  let showAll = $state(false)

  const visible = $derived(showAll ? supporters : supporters.slice(0, 5))

  const expand = () => {
    showAll = true
  }
</script>

<div class="flex flex-col gap-4 card w-full">
  <div class="flex items-center justify-between gap-2">
    <h2 class="text-lg font-bold">Supporters</h2>
    {#if supporters.length > 0}
      <span class="badge badge-primary badge-sm">
        <Icon icon={Bolt} size={4} />
        {progress.raised.toLocaleString()} sats from {supporters.length}
      </span>
    {/if}
  </div>
  {#if supporters.length > 0}
    <div class="flex flex-col gap-3">
      {#each visible as supporter, rank (supporter.pubkey)}
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-3">
            <div class="flex w-6 shrink-0 justify-center">
              {#if rank === 0}
                <Icon icon={Crown} size={5} class="text-warning" />
              {:else}
                <span class="text-sm text-content-subtle">{rank + 1}</span>
              {/if}
            </div>
            <ProfileCircle pubkey={supporter.pubkey} {url} size={8} />
            <div class="flex min-w-0 grow flex-col">
              <span class="truncate font-bold">
                <ProfileName pubkey={supporter.pubkey} {url} />
              </span>
              <span class="text-xs text-content-subtle">
                {formatTimestampRelative(supporter.zappedAt)}
              </span>
            </div>
            <span class="shrink-0 whitespace-nowrap font-bold text-primary">
              {supporter.amount.toLocaleString()}
            </span>
          </div>
          <div class="ml-9 h-1 overflow-hidden rounded-full bg-surface-more">
            <div
              class="h-full rounded-full bg-primary opacity-60"
              style:width="{topAmount > 0 ? (supporter.amount / topAmount) * 100 : 0}%">
            </div>
          </div>
          {#if supporter.comment}
            <p class="ml-9 wrap-break-word text-sm text-content-muted">{supporter.comment}</p>
          {/if}
        </div>
      {/each}
    </div>
    {#if supporters.length > visible.length}
      <Button class="button button-link self-center" onclick={expand}>
        Show all {supporters.length} supporters
      </Button>
    {/if}
  {:else}
    <div class="flex flex-col items-center gap-3 py-4 text-center">
      <p class="text-content-muted">
        No one has contributed yet. Send the first zap and get top billing.
      </p>
      {#if ENABLE_ZAPS && !progress.isEnded}
        <ZapButton {url} {event} class="button button-primary">
          <Icon icon={Bolt} />
          Be the first
        </ZapButton>
      {/if}
    </div>
  {/if}
</div>
