<script lang="ts">
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
  import InputList from "@lib/components/InputList.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {setFeaturedContent} from "@app/features/featured"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url: string
    initial: string[]
  }

  const {url, initial}: Props = $props()

  let content = $state([...initial])
  let loading = $state(false)

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      const publication = await setFeaturedContent(url, content)
      const error = await publication.getError()

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Featured content updated!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update featured content."})
    } finally {
      loading = false
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Featured Content</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet info()}
        <p>
          Each entry is shown on the space's About page. Links will be fetched and displayed
          automatically.
        </p>
      {/snippet}
      {#snippet input()}
        <InputList bind:value={content} placeholder="URL or nevent...">
          {#snippet addLabel()}
            Add content
          {/snippet}
        </InputList>
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={submit} disabled={loading}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
