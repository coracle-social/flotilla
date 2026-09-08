<script lang="ts">
  import cx from "classnames"
  import {remove} from "@welshman/lib"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {chatSearch} from "@app/chats"
  import {user} from "@app/core"
  import {deriveUserRoomSearch} from "@app/rooms"
  import {makeChatPath, makeRoomPath} from "@app/routes"
  import {shareTo, type Share} from "@app/share"

  type Props = {
    share: Share
  }

  const {share}: Props = $props()

  const roomSearch = deriveUserRoomSearch()

  const toggle = (path: string) => {
    selection = path === selection ? "" : path
  }

  const back = () => history.back()

  const submit = () => shareTo(selection, share)

  let term = $state("")
  let selection = $state("")

  const roomResults = $derived($roomSearch.searchOptions(term))
  const chatResults = $derived($chatSearch.searchOptions(term))
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Share</ModalTitle>
      <ModalSubtitle>Where would you like to share this?</ModalSubtitle>
    </ModalHeader>
    <label class="input input-sm flex w-full items-center gap-2">
      <Icon size={4} icon={Magnifier} />
      <input
        bind:value={term}
        class="min-w-0 grow"
        type="text"
        placeholder="Search rooms and conversations..." />
    </label>
    <div class="flex min-h-96 flex-col gap-4">
      {#if roomResults.length > 0}
        <p class="text-xs uppercase tracking-wide opacity-60">Rooms</p>
        <div class="flex flex-col gap-2">
          {#each roomResults as { url, h } (makeRoomPath(url, h))}
            {@const path = makeRoomPath(url, h)}
            <Button
              type="button"
              class={cx(
                "flex w-full min-w-0 items-center justify-between gap-2 button",
                selection === path ? "button-primary" : "button-neutral",
              )}
              onclick={() => toggle(path)}>
              <RoomNameWithImage {url} {h} />
              <RelayName {url} class="min-w-0 truncate text-xs opacity-60" />
            </Button>
          {/each}
        </div>
      {/if}
      {#if chatResults.length > 0}
        <p class="text-xs uppercase tracking-wide opacity-60">Direct Messages</p>
        <div class="flex flex-col gap-2">
          {#each chatResults as chat (chat.id)}
            {@const path = makeChatPath(chat.pubkeys)}
            {@const others = remove($user.pubkey, chat.pubkeys)}
            <Button
              type="button"
              class={cx(
                "flex w-full min-w-0 items-center justify-start gap-2 button",
                selection === path ? "button-primary" : "button-neutral",
              )}
              onclick={() => toggle(path)}>
              {#if others.length > 1}
                <ProfileCircles pubkeys={others} size={5} />
                <span class="min-w-0 truncate">
                  <ProfileName pubkey={others[0]} />
                  +{others.length - 1}
                </span>
              {:else if others.length === 1}
                <ProfileCircle pubkey={others[0]} size={5} />
                <span class="min-w-0 truncate">
                  <ProfileName pubkey={others[0]} />
                </span>
              {:else}
                <ProfileCircle pubkey={$user.pubkey} size={5} />
                Note to self
              {/if}
            </Button>
          {/each}
        </div>
      {/if}
      {#if roomResults.length === 0 && chatResults.length === 0}
        <p class="py-12 text-center opacity-75">
          {#if term}
            Nothing matched your search.
          {:else}
            Join a space or start a conversation to have somewhere to share to.
          {/if}
        </p>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!selection}>
      Share
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
