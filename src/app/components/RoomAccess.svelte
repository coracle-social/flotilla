<script lang="ts">
  import EyeClosed from "@assets/icons/eye-closed.svg?dataurl"
  import Lock from "@assets/icons/lock.svg?dataurl"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {rooms} from "@app/core/plugins"

  type Props = {
    h: string
    url: string
  }

  const {url, h}: Props = $props()

  const room = $rooms.forRoom(url, h)
</script>

{#if $room?.meta?.isHidden()}
  <Button
    class="button button-neutral button-sm tip tip-left"
    data-tip="This room is not visible to non-members.">
    <Icon size={4} icon={EyeClosed} />
  </Button>
{:else if $room?.meta?.isPrivate()}
  <Button
    class="button button-neutral button-sm tip tip-left"
    data-tip="Only members can view messages.">
    <Icon size={4} icon={Lock} />
  </Button>
{:else if $room?.meta?.isRestricted()}
  <Button
    class="button button-neutral button-sm tip tip-left"
    data-tip="Only members can send messages.">
    <Icon size={4} icon={Microphone} />
  </Button>
{/if}
