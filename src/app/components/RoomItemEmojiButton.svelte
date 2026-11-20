<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {user} from "@app/core/user"
  import {publishReaction} from "@app/areas/spaces"
  import {promptLogin} from "@app/components/flows/login"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const onEmoji = (emoji: string) => publishReaction(url, event, {content: emoji, tags: []})
</script>

{#if $user}
  <EmojiButton
    aria-label="Add a reaction"
    {onEmoji}
    class="button button-xs button-neutral join-item"
    tippyParams={{placement: "bottom-end"}}>
    <Icon icon={SmileCircle} size={4} />
  </EmojiButton>
{:else}
  <Button
    aria-label="Add a reaction"
    class="button button-xs button-neutral join-item"
    onclick={promptLogin}>
    <Icon icon={SmileCircle} size={4} />
  </Button>
{/if}
