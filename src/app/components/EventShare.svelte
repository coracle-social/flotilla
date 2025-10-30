<script lang="ts">
  import {goto} from "$app/navigation"
  import type {TrustedEvent} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {roomsByUrl} from "@app/core/state"
  import {makeRoomPath} from "@app/util/routes"

  const {url, noun, event}: {url: string; noun: string; event: TrustedEvent} = $props()

  const back = () => history.back()

  const onSubmit = () => {
    setKey("share", event)
    goto(makeRoomPath(url, selection), {replaceState: true})
  }

  const toggleRoom = (h: string) => {
    selection = h === selection ? "" : h
  }

  let selection = $state("")
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Share {noun}</div>
    {/snippet}
    {#snippet info()}
      <div>Which room would you like to share this event to?</div>
    {/snippet}
  </ModalHeader>
  <div class="grid grid-cols-3 gap-2">
    {#each $roomsByUrl.get(url) || [] as room (room.h)}
      <button
        type="button"
        class="btn"
        class:btn-neutral={selection !== room.h}
        class:btn-primary={selection === room.h}
        onclick={() => toggleRoom(room.h)}>
        #<RoomName {...room} />
      </button>
    {/each}
  </div>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={!selection}>
      Share {noun}
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
