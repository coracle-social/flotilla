<script lang="ts">
  import {derived} from "svelte/store"
  import {PINBOARD} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {Pinboard} from "@welshman/domain"
  import type {PinboardReader} from "@welshman/domain"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import PinAdd from "@app/components/PinAdd.svelte"
  import {reader} from "@app/core"
  import {eventToReference} from "@app/pinboards"
  import {deriveEventsForUrl} from "@app/repository"
  import {makeSpacePath} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const boards = derived(deriveEventsForUrl(url, [{kinds: [PINBOARD]}]), $events =>
    $events.map(reader(Pinboard)),
  )

  const reference = eventToReference(event)

  const selectBoard = (board: PinboardReader) =>
    pushModal(PinAdd, {url, address: board.address(), reference})
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Add to Library</ModalTitle>
    <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
  </ModalHeader>
  <ModalBody class="flex flex-col gap-2">
    {#if $boards.length === 0}
      <div class="flex flex-col items-center gap-4 py-8 text-center">
        <p class="opacity-70">This space doesn't have any shelves yet.</p>
        <Link href={makeSpacePath(url, "library")} class="button button-primary">
          Go to Library
        </Link>
      </div>
    {:else}
      {#each $boards as board (board.address())}
        <Button
          class="card card-sm card-interactive flex flex-row items-center justify-between gap-3"
          onclick={() => selectBoard(board)}>
          <span class="flex min-w-0 flex-col">
            <strong class="truncate min-w-0">{board.title() || "Untitled shelf"}</strong>
            {#if board.description()}
              <span class="truncate min-w-0 text-sm opacity-70">{board.description()}</span>
            {/if}
          </span>
          <Icon size={4} icon={AltArrowRight} class="shrink-0" />
        </Button>
      {/each}
    {/if}
  </ModalBody>
</Modal>
