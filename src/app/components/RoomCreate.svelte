<script lang="ts">
  import {goto} from "$app/navigation"
  import {uniqBy, nth} from "@welshman/lib"
  import {displayRelayUrl, makeRoomMeta} from "@welshman/util"
  import {deriveRelay, waitForThunkError, createRoom, editRoom, joinRoom} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Field from "@lib/components/Field.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Hashtag from "@assets/icons/hashtag-circle.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {hasNip29, loadChannel} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"
  import {pushToast} from "@app/util/toast"

  const {url} = $props()

  const room = makeRoomMeta()
  const relay = deriveRelay(url)

  const back = () => history.back()

  const tryCreate = async () => {
    room.tags = uniqBy(nth(0), [...room.tags, ["name", name]])

    const createMessage = await waitForThunkError(createRoom(url, room))

    if (createMessage && !createMessage.match(/^duplicate:|already a member/)) {
      return pushToast({theme: "error", message: createMessage})
    }

    const editMessage = await waitForThunkError(editRoom(url, room))

    if (editMessage) {
      return pushToast({theme: "error", message: editMessage})
    }

    const joinMessage = await waitForThunkError(joinRoom(url, room))

    if (joinMessage && !joinMessage.includes("already")) {
      return pushToast({theme: "error", message: joinMessage})
    }

    await loadChannel(url, room.id)

    goto(makeSpacePath(url, room.id))
  }

  const create = async () => {
    loading = true

    try {
      await tryCreate()
    } finally {
      loading = false
    }
  }

  let name = $state("")
  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(create)}>
  <ModalHeader>
    {#snippet title()}
      <div>Create a Room</div>
    {/snippet}
    {#snippet info()}
      <div>
        On <span class="text-primary">{displayRelayUrl(url)}</span>
      </div>
    {/snippet}
  </ModalHeader>
  {#if hasNip29($relay)}
    <Field>
      {#snippet label()}
        <p>Room Name</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={Hashtag} />
          <input bind:value={name} class="grow" type="text" />
        </label>
      {/snippet}
    </Field>
  {:else}
    <p class="bg-alt card2 row-2">
      <Icon icon={Danger} />
      This relay does not support creating rooms.
    </p>
  {/if}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={!name || loading || !hasNip29($relay)}>
      <Spinner {loading}>Create Room</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
