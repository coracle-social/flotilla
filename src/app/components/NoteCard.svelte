<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {goToEvent} from "@app/routes"
  import {isEventMuted} from "@app/social"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    minimal?: boolean
    hideProfile?: boolean
    url?: string
    class?: string
    style?: string
  }

  const {event, children, minimal = false, hideProfile = false, url, ...restProps}: Props = $props()

  const ignoreMute = () => {
    muted = false
  }

  const goToNote = () => goToEvent(event)

  let muted = $state($isEventMuted(event))
</script>

<div class="flex flex-col gap-2 {restProps.class}" style={restProps.style}>
  {#if muted}
    <div class="flex items-center justify-between">
      <div class="flex gap-2 relative">
        <Icon icon={Danger} class="mt-1" />
        <p>You have muted this person.</p>
      </div>
      <Button class="link ml-8" onclick={ignoreMute}>Show anyway</Button>
    </div>
  {:else}
    <!-- The size container is the header, not the card: container-type contains a box's inline
         size, so a card that is its own container reports no width to an ancestor sized by its
         contents and collapses a quote inside a chat bubble. The header fills the card either way,
         so the query still measures the card's width. -->
    <div class="@container flex items-start justify-between gap-2">
      {#if !hideProfile}
        {#if minimal}
          @<ProfileName pubkey={event.pubkey} {url} />
        {:else}
          <Profile pubkey={event.pubkey} {url} />
        {/if}
      {/if}
      <Button
        class={cx("text-sm opacity-75 @max-sm:hidden", {"text-xs": minimal})}
        onclick={goToNote}>
        {formatTimestamp(event.created_at)}
      </Button>
    </div>
    {@render children?.()}
  {/if}
</div>
