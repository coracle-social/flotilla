<script lang="ts">
  import {onMount} from "svelte"
  import {uniq} from "@welshman/lib"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import type {PinReader} from "@welshman/domain"
  import {normalizeTopic} from "@lib/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import ContentActions from "@app/components/ContentActions.svelte"
  import PinContent from "@app/components/PinContent.svelte"
  import PinSave from "@app/components/PinSave.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import {events, network} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {buildCommentTree} from "@app/social"

  type Props = {
    url: string
    pin: PinReader
    context: FeedContext
  }

  const {url, pin, context}: Props = $props()

  const filters = getCommentFiltersForRoot([pin.event])
  const comments = $events.asc(filters).$
  const topics = $derived(uniq(pin.topics().map(normalizeTopic)))
  const nodes = $derived(buildCommentTree(pin.event, $comments))

  const setReplyTo = (comment?: TrustedEvent) => {
    replyTo = comment
  }

  const clearReplyTo = () => setReplyTo(undefined)

  const replyToPin = () => setReplyTo(pin.event)

  let replyTo: TrustedEvent | undefined = $state()

  onMount(() => {
    const controller = new AbortController()

    $network.request({relays: [url], filters, signal: controller.signal})

    return () => controller.abort()
  })
</script>

{#snippet topicLabels()}
  {#each topics as topic (topic)}
    <span class="badge badge-neutral badge-sm font-normal">#{topic}</span>
  {/each}
{/snippet}

<Modal label="Link">
  <ModalBody>
    <div class="border-line flex flex-col gap-3 border-b pb-4">
      {#if pin.title()}
        <strong class="text-2xl">{pin.title()}</strong>
      {/if}
      <PinContent {url} {pin} />
      <p class="text-sm opacity-75">
        Added by <ProfileLink pubkey={pin.event.pubkey} {url} />
      </p>
      <div class="flex flex-wrap items-center justify-end gap-2">
        {#if replyTo?.id !== pin.event.id}
          <Button class="button button-neutral button-xs" onclick={replyToPin}>
            <Icon size={4} icon={Reply} />
            Comment
          </Button>
        {/if}
        <ContentActions
          noun="Link"
          editForm={PinSave}
          labels={topics.length > 0 ? topicLabels : undefined}
          {url}
          event={pin.event}
          {context} />
      </div>
      {#if replyTo?.id === pin.event.id}
        <CommentCompose {url} event={pin.event} onCancel={clearReplyTo} onSubmit={clearReplyTo} />
      {/if}
    </div>
    <div class="flex flex-col">
      {#each nodes as node (node.comment.id)}
        <CommentTree {node} root={pin.event} {replyTo} {setReplyTo} {url} {context} />
      {/each}
      {#if nodes.length === 0}
        <p class="py-2 text-sm opacity-75">No comments yet.</p>
      {/if}
    </div>
  </ModalBody>
</Modal>
