<script lang="ts">
  import {nip19} from "nostr-tools"
  import {goto} from "$app/navigation"
  import {ctx} from "@welshman/lib"
  import {toNostrURI} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ChannelName from "@app/components/ChannelName.svelte"
  import {channelsByUrl} from "@app/state"
  import {makeRoomPath} from "@app/routes"
  import {setKey} from "@app/implicit"

  export let url
  export let event

  const relays = ctx.app.router.Event(event).getUrls()
  const nevent = nip19.neventEncode({id: event.id, relays})

  const back = () => history.back()

  const onSubmit = () => {
    setKey("content", toNostrURI(nevent))
    goto(makeRoomPath(url, selection), {replaceState: true})
  }

  const toggleRoom = (room: string) => {
    selection = room === selection ? "" : room
  }

  let selection = ""
</script>

<form class="column gap-4" on:submit|preventDefault={onSubmit}>
  <ModalHeader>
    <div slot="title">Share Thread</div>
    <div slot="info">Which room would you like to share this thread to?</div>
  </ModalHeader>
  <div class="grid grid-cols-3 gap-2">
    {#each $channelsByUrl.get(url) || [] as channel (channel.room)}
      <button
        type="button"
        class="btn"
        class:btn-neutral={selection !== channel.room}
        class:btn-primary={selection === channel.room}
        on:click={() => toggleRoom(channel.room)}>
        #<ChannelName {...channel} />
      </button>
    {/each}
  </div>
  <ModalFooter>
    <Button class="btn btn-link" on:click={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={!selection}>
      Share Thread
      <Icon icon="alt-arrow-right" />
    </Button>
  </ModalFooter>
</form>
