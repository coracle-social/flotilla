<script lang="ts">
  import {derived} from "svelte/store"
  import {filter, formatTimestampRelative, spec, uniq} from "@welshman/lib"
  import {COMMENT} from "@welshman/util"
  import type {PinReader} from "@welshman/domain"
  import {normalizeTopic} from "@lib/util"
  import ChatRoundDots from "@assets/icons/chat-round-dots.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ContentActions from "@app/components/ContentActions.svelte"
  import PinContent from "@app/components/PinContent.svelte"
  import PinDetail from "@app/components/PinDetail.svelte"
  import PinSave from "@app/components/PinSave.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import type {FeedContext} from "@app/features/feeds"
  import {pushModal} from "@app/ui/modal"

  type Props = {
    url: string
    pin: PinReader
    context: FeedContext
    card?: boolean
  }

  const {url, pin, context, card = true}: Props = $props()

  const topics = $derived(uniq(pin.topics().map(normalizeTopic)))
  const related = context.related(pin.event)
  const comments = derived(related, $related => filter(spec({kind: COMMENT}), $related))

  const discuss = () => pushModal(PinDetail, {url, pin, context}, {size: "large"})
</script>

{#snippet topicLabels()}
  {#each topics as topic (topic)}
    <span class="badge badge-neutral badge-sm font-normal">#{topic}</span>
  {/each}
{/snippet}

{#snippet body()}
  <div class="flex min-w-0 items-center gap-2 text-xs text-content-muted">
    <ProfileCircle pubkey={pin.event.pubkey} {url} size={4} />
    <span class="min-w-0 truncate">
      <ProfileLink unstyled pubkey={pin.event.pubkey} {url} />
    </span>
    <span class="whitespace-nowrap">{formatTimestampRelative(pin.event.created_at)}</span>
  </div>
  {#if pin.title()}
    <strong class="min-w-0">{pin.title()}</strong>
  {/if}
  <PinContent {url} {pin} />
  <div class="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
    <Button class="button button-neutral button-xs" onclick={discuss}>
      <Icon size={4} icon={ChatRoundDots} />
      {#if $comments.length > 0}
        {$comments.length}
        {$comments.length === 1 ? "comment" : "comments"}
      {:else}
        Discuss
      {/if}
    </Button>
    <ContentActions
      noun="Link"
      editForm={PinSave}
      labels={topics.length > 0 ? topicLabels : undefined}
      {url}
      event={pin.event}
      {context} />
  </div>
{/snippet}

{#if card}
  <Cv data-component="PinItem" class="card flex h-full flex-col gap-2">
    {@render body()}
  </Cv>
{:else}
  <Cv
    data-component="PinItem"
    class="flex flex-col gap-2 border-b border-solid border-line px-4 py-4">
    {@render body()}
  </Cv>
{/if}
