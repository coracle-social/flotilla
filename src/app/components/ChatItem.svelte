<script lang="ts">
  import {onMount} from "svelte"
  import cx from "classnames"
  import {page} from "$app/stores"
  import {remove, uniq, formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {fade} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import ChatTitle from "@app/components/ChatTitle.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {makeChatPath, goToChat} from "@app/routes"
  import {notifications} from "@app/notifications"
  import {messagingRelayLists, user} from "@app/core"

  type Props = {
    id: string
    pubkeys: string[]
    messages: TrustedEvent[]
    class?: string
  }

  const {...props}: Props = $props()

  const others = uniq(remove($user.pubkey, props.pubkeys))
  const active = $derived($page.params.chat === props.id)
  const path = makeChatPath(props.pubkeys)
  const openChat = () => goToChat(props.pubkeys)

  onMount(() => {
    for (const pk of others) {
      $messagingRelayLists.load(pk)
    }
  })
</script>

<Button class="flex flex-col justify-start gap-1 w-full" onclick={openChat}>
  <div
    class={cx(
      "cursor-pointer border-t border-solid border-line px-3 py-2 transition-colors hover:bg-surface",
      props.class,
      {"bg-surface": active},
    )}>
    <div class="flex flex-col justify-start gap-1">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          {#if others.length > 1}
            <ProfileCircles pubkeys={others} size={5} />
          {:else}
            <ProfileCircle pubkey={others[0] || $user.pubkey} size={5} />
          {/if}
          <p class="overflow-hidden text-ellipsis whitespace-nowrap">
            <ChatTitle pubkeys={props.pubkeys} />
          </p>
        </div>
        {#if !active && $notifications.has(path)}
          <div class="h-2 w-2 rounded-full bg-primary text-primary-content" transition:fade></div>
        {/if}
      </div>
      <p class="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
        <span class="opacity-70">
          {#if props.messages[0].pubkey === $user.pubkey}
            You:
          {/if}
        </span>
        {props.messages[0].content}
      </p>
      <p class="text-xs opacity-70">
        {formatTimestamp(props.messages[0].created_at)}
      </p>
    </div>
  </div>
</Button>
