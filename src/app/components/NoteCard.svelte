<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {isEventMuted} from "@app/features/social/muting"
  import {goToEvent} from "@app/navigation/locations"
  import {getPublishedTimestamp} from "@app/features/spaces/articles"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    minimal?: boolean
    hideProfile?: boolean
    interactive?: boolean
    onOpen?: () => void
    url?: string
    class?: string
    style?: string
  }

  const {
    event,
    children,
    minimal = false,
    hideProfile = false,
    interactive = false,
    onOpen,
    url,
    ...restProps
  }: Props = $props()

  const open = $derived(onOpen ?? (() => goToEvent(event)))

  const ignoreMute = () => {
    muteDismissed = event.id
  }

  const goToNote = () => {
    // Releasing a text selection inside the card is not a click on it.
    if (!window.getSelection()?.toString()) {
      open()
    }
  }

  // Keyed by note, since a card can be handed another one after Show anyway.
  let muteDismissed = $state<string>()

  const muted = $derived($isEventMuted(event) && muteDismissed !== event.id)
</script>

<div
  {...restProps}
  onclick={interactive ? goToNote : undefined}
  class={cx("flex flex-col gap-2", restProps.class)}>
  <div class="flex items-start justify-between gap-2">
    {#if !hideProfile}
      {#if minimal}
        @<ProfileName pubkey={event.pubkey} />
      {:else}
        <Profile pubkey={event.pubkey} {url} />
      {/if}
    {/if}
    <Button
      class={cx("whitespace-nowrap text-sm opacity-75", {"text-xs": minimal})}
      onclick={goToNote}>
      {formatTimestamp(getPublishedTimestamp(event))}
    </Button>
  </div>
  {#if muted}
    <div class="card card-sm shadow-none flex gap-2">
      <Icon icon={Danger} />
      <p>
        You have muted this person.<br />
        <Button onclick={ignoreMute} class="button button-link">Show anyway</Button>
      </p>
    </div>
  {:else}
    {@render children?.()}
  {/if}
</div>
