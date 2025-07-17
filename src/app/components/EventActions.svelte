<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Instance} from "tippy.js"
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import EventMenu from "@app/components/EventMenu.svelte"
  import {ENABLE_ZAPS} from "@app/state"
  import {publishReaction} from "@app/commands"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
    hideZap?: boolean
    customActions?: Snippet
  }

  const {url, noun, event, hideZap, customActions}: Props = $props()

  const showPopover = () => popover?.show()

  const hidePopover = () => popover?.hide()

  const onEmoji = (emoji: NativeEmoji) =>
    publishReaction({event, content: emoji.unicode, relays: [url]})

  let popover: Instance | undefined = $state()
</script>

<Button class="join rounded-full">
  {#if ENABLE_ZAPS && !hideZap}
    <ZapButton {url} {event} class="btn join-item btn-neutral btn-xs">
      <Icon icon="bolt" size={4} />
    </ZapButton>
  {/if}
  <EmojiButton {onEmoji} class="btn join-item btn-neutral btn-xs">
    <Icon icon="smile-circle" size={4} />
  </EmojiButton>
  <Tippy
    bind:popover
    component={EventMenu}
    props={{url, noun, event, customActions, onClick: hidePopover}}
    params={{trigger: "manual", interactive: true}}>
    <Button class="btn join-item btn-neutral btn-xs" onclick={showPopover}>
      <Icon icon="menu-dots" size={4} />
    </Button>
  </Tippy>
</Button>
