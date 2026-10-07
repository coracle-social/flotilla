<script lang="ts">
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {createBookmarkFolder, renameBookmarkFolder} from "@app/bookmarks"
  import type {BookmarkFolder} from "@app/bookmarks"
  import {popModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    folder?: BookmarkFolder
  }

  const {folder}: Props = $props()

  const identifier = folder?.identifier

  const submit = async () => {
    loading = true

    try {
      const error = identifier
        ? await renameBookmarkFolder(identifier, title.trim())
        : await createBookmarkFolder(title.trim())

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: identifier ? "Folder renamed!" : "Folder created!"})
        popModal()
      }
    } finally {
      loading = false
    }
  }

  let title = $state(folder?.title || "")
  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{identifier ? "Rename Folder" : "New Folder"}</ModalTitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Name
      {/snippet}
      {#snippet input()}
        <input bind:value={title} class="input w-full" placeholder="Folder name" />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={popModal}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={submit} disabled={loading || !title.trim()}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
