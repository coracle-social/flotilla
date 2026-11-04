<script lang="ts">
  import cx from "classnames"
  import type {Maybe} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Logout2 from "@assets/icons/logout-2.svg?dataurl"
  import UserMinus from "@assets/icons/user-minus.svg?dataurl"
  import UserBlock from "@assets/icons/user-block.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {relayManagement, rooms} from "@app/core/plugins"
  import {deriveSpacePermissions, spaceManagement} from "@app/features/spaces/management"
  import {deriveMemberModeration} from "@app/features/spaces/rooms"
  import {pushToast} from "@app/features/toast"

  type Props = {
    url: string
    pubkey: string
    h?: string
  }

  const {url, pubkey, h = ""}: Props = $props()

  const moderation = deriveMemberModeration(url, h)
  const permissions = deriveSpacePermissions(url)
  const options = $derived($moderation(pubkey))

  const back = () => history.back()

  const removeFromRoom = async () => {
    const command = await $rooms.removeMember(url, {h}, pubkey)

    return command.publish().getError()
  }

  const removeFromSpace = async () => {
    const {error} = await $relayManagement.forUrl(url).unallowPubkey(pubkey)

    return error
  }

  const ban = async () => {
    const {error} = await $relayManagement.forUrl(url).banPubkey(pubkey)

    if (error) {
      return error
    }

    if ($permissions.listBans) {
      await $spaceManagement.loadBannedPubkeys(url)
    }
  }

  const submit = async () => {
    loading = true

    try {
      let error: Maybe<string>
      let message = ""

      if (action === "room") {
        error = await removeFromRoom()
        message = "They've been removed from the room."
      } else if (action === "space") {
        error = await removeFromSpace()
        message = "They've been removed from the space."
      } else if (action === "ban") {
        error = await ban()
        message = "They've been banned from the space."
      }

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update this member."})
    } finally {
      loading = false
    }
  }

  let action: Maybe<"room" | "space" | "ban"> = $state()
  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Manage Member</ModalTitle>
      <ModalSubtitle>Manage room and space membership</ModalSubtitle>
    </ModalHeader>
    <div class="card card-sm">
      <Profile inert {pubkey} {url} />
    </div>
    <div class="flex flex-col gap-2" role="radiogroup" aria-label="Action">
      {#if options.removeFromRoom}
        <label
          class="card card-sm flex cursor-pointer items-start gap-3 has-checked:border-primary">
          <span
            class="bg-surface-more flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Icon icon={Logout2} size={5} />
          </span>
          <span class="flex min-w-0 grow flex-col gap-1">
            <strong>Remove from <RoomName {url} {h} /></strong>
            <span class="text-content-muted text-sm">
              They come off this room's member list but stay in the space, and can ask to join the
              room again.
            </span>
          </span>
          <input type="radio" class="radio mt-2" name="action" value="room" bind:group={action} />
        </label>
      {/if}
      {#if options.removeFromSpace}
        <label
          class="card card-sm flex cursor-pointer items-start gap-3 has-checked:border-primary">
          <span
            class="bg-surface-more flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Icon icon={UserMinus} size={5} />
          </span>
          <span class="flex min-w-0 grow flex-col gap-1">
            <strong>Remove from the space</strong>
            <span class="text-content-muted text-sm">
              They lose access to the space and all of its rooms. They can come back with an invite,
              or by joining again if the space is open.
            </span>
          </span>
          <input type="radio" class="radio mt-2" name="action" value="space" bind:group={action} />
        </label>
      {/if}
      {#if options.ban}
        <label class="card card-sm flex cursor-pointer items-start gap-3 has-checked:border-error">
          <span
            class="bg-surface-more text-error flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Icon icon={UserBlock} size={5} />
          </span>
          <span class="flex min-w-0 grow flex-col gap-1">
            <strong class="text-error">Ban from the space</strong>
            <span class="text-content-muted text-sm">
              They're removed and kept out, even with an invite. What they've posted in the space
              may be deleted too, and lifting the ban won't bring it back.
            </span>
          </span>
          <input
            type="radio"
            class="radio checked:border-error checked:after:bg-error mt-2"
            name="action"
            value="ban"
            bind:group={action} />
        </label>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      type="submit"
      class={cx("button", {"button-error": action === "ban", "button-primary": action !== "ban"})}
      disabled={!action || loading}>
      <Spinner {loading}>
        {#if action === "room"}
          Remove from room
        {:else if action === "space"}
          Remove from space
        {:else if action === "ban"}
          Ban member
        {:else}
          Choose an action
        {/if}
      </Spinner>
    </Button>
  </ModalFooter>
</Modal>
