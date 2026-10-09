<script lang="ts">
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Folder from "@assets/icons/folder.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import {moveBookmark, userBookmarkFolders} from "@app/bookmarks"
  import type {BookmarkFolder} from "@app/bookmarks"
  import {popModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    folder: BookmarkFolder
    tag: string[]
  }

  const {folder, tag}: Props = $props()

  const move = (to?: string) => async () => {
    popModal()

    const error = await moveBookmark(tag, to)

    if (error) {
      pushToast({theme: "error", message: error})
    }
  }
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Move Bookmark</ModalTitle>
    <ModalSubtitle>Pick the folder to keep it in.</ModalSubtitle>
  </ModalHeader>
  <ModalBody class="flex flex-col gap-2">
    {#each $userBookmarkFolders as option (option.identifier || "")}
      {@const current = option.identifier === folder.identifier}
      <Button
        disabled={current}
        class="card card-sm card-interactive flex flex-row items-center justify-between gap-3"
        onclick={move(option.identifier)}>
        <span class="flex min-w-0 items-center gap-3">
          <Icon size={4} icon={Folder} class="shrink-0" />
          <strong class="truncate min-w-0">{option.title}</strong>
        </span>
        <Icon size={4} icon={current ? CheckCircle : AltArrowRight} class="shrink-0" />
      </Button>
    {/each}
    {#if $userBookmarkFolders.length === 1}
      <p class="py-6 text-center text-sm text-content-muted">
        You have no folders yet. Make one with the New folder button on your bookmarks.
      </p>
    {/if}
  </ModalBody>
</Modal>
