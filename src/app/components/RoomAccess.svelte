<script lang="ts">
  import EyeClosed from "@assets/icons/eye-closed.svg?dataurl"
  import Lock from "@assets/icons/lock.svg?dataurl"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {deriveRoom} from "@app/core/state"

  interface Props {
    h: any
    url: any
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
</script>

{#if $room.isHidden}
  <Button
    class="btn btn-neutral btn-sm tooltip tooltip-left"
    data-tip="This room is not visible to non-members.">
    <Icon size={4} icon={EyeClosed} />
  </Button>
{:else if $room.isPrivate}
  <Button
    class="btn btn-neutral btn-sm tooltip tooltip-left"
    data-tip="Only members can view messages.">
    <Icon size={4} icon={Lock} />
  </Button>
{:else if $room.isRestricted}
  <Button
    class="btn btn-neutral btn-sm tooltip tooltip-left"
    data-tip="Only members can send messages.">
    <Icon size={4} icon={Microphone} />
  </Button>
{/if}
