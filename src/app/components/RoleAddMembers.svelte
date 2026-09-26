<script lang="ts">
  import type {RelayRoleReader} from "@welshman/domain"
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
  import {relayManagement} from "@app/core"
  import {allowPubkeys} from "@app/management"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    role: RelayRoleReader
  }

  const {url, role}: Props = $props()

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      const management = $relayManagement.forUrl(url)

      // Members have to be allowed at the relay before a role there means anything
      let error = await allowPubkeys(url, pubkeys)

      for (const pubkey of pubkeys) {
        if (!error) {
          error = (await management.assignRole(pubkey, role.identifier()!)).error
        }
      }

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Members assigned!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to assign members."})
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
      <ModalTitle>Add to {role.label() || "Role"}</ModalTitle>
      <ModalSubtitle>Assign members to this role</ModalSubtitle>
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
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
