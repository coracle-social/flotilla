<script lang="ts">
  import {navigate} from "@app/modal"
  import {getAddress, relay} from "@welshman/util"
  import {publish} from "@welshman/app"
  import {Pinboard} from "@welshman/domain"
  import type {PinboardReader} from "@welshman/domain"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {command, relays, writer} from "@app/core"
  import {makeLibraryPath} from "@app/routes"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    board?: PinboardReader
  }

  const {url, board}: Props = $props()

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      const eventWriter = writer(Pinboard, board)
        .setTitle(title)
        .setDescription(description)
        .setProtected(await $relays.hasNip(url, 70))
        .forceRoutes(relay(url))

      if (!board) {
        eventWriter.setIdentifier().setCollaborative(true)
      }

      const thunk = await command(eventWriter).then(publish)
      const error = await thunk.waitForError()

      if (error) {
        pushToast({theme: "error", message: error})
      } else if (board) {
        pushToast({message: "Shelf updated!"})
        back()
      } else {
        pushToast({message: "Shelf created!"})
        navigate(makeLibraryPath(url, getAddress(thunk.options.event)))
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "This space refused to save the shelf."})
    } finally {
      loading = false
    }
  }

  let title = $state(board?.title() ?? "")
  let description = $state(board?.description() ?? "")
  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{board ? "Edit Shelf" : "Create Shelf"}</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Title
      {/snippet}
      {#snippet input()}
        <input bind:value={title} class="input w-full" placeholder="Shelf title" />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Description
      {/snippet}
      {#snippet input()}
        <input
          bind:value={description}
          class="input w-full"
          placeholder="What's this shelf about?" />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={submit} disabled={loading || !title.trim()}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
