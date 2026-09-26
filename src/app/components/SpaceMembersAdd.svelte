<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
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
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {allowPubkeys} from "@app/management"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      const error = await allowPubkeys(url, pubkeys)

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Members have successfully been added!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to add members."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let pubkeys: string[] = $state([])
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add Members</ModalTitle>
      <ModalSubtitle>
        to <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Search for People</p>
      {/snippet}
      {#snippet input()}
        <ProfileMultiSelect bind:value={pubkeys} />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      class="button button-primary"
      onclick={submit}
      disabled={loading || pubkeys.length === 0}>
      <Spinner {loading}>Save</Spinner>
    </Button>
  </ModalFooter>
</Modal>
