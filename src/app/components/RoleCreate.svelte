<script lang="ts">
  import {randomId} from "@welshman/lib"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoleForm, {type Values} from "@app/components/RoleForm.svelte"
  import {relayManagement} from "@app/core/plugins"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const back = () => history.back()

  let loading = $state(false)

  const onSubmit = async ({label, description, color}: Values) => {
    loading = true

    try {
      const {error} = await $relayManagement
        .forUrl(url)
        .createRole(randomId(), label, description, color, 1)

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Role created!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to create role."})
    } finally {
      loading = false
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create Role</ModalTitle>
      <ModalSubtitle>in <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <RoleForm {loading} {onSubmit} />
  </ModalBody>
</Modal>
