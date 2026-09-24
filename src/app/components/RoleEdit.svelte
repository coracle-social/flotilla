<script lang="ts">
  import type {RelayRoleReader} from "@welshman/domain"
  import {makeRelayRoleKey} from "@welshman/app"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoleForm, {type Values} from "@app/components/RoleForm.svelte"
  import {relayManagement, relayRoles} from "@app/core"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    role: RelayRoleReader
  }

  const {url, role}: Props = $props()

  const id = role.identifier() ?? ""

  const initialValues = {
    label: role.label() ?? "",
    description: role.description() ?? "",
    color: role.color(),
  }

  const back = () => history.back()

  const onSubmit = async ({label, description, color}: Values) => {
    loading = true

    try {
      const {error} = await $relayManagement
        .forUrl(url)
        .editRole(id, label, description, color, role.order())

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        // Pull the relay's freshly-signed role event rather than waiting for the subscription.
        await $relayRoles.forceLoad(makeRelayRoleKey(url, id))

        pushToast({message: "Role updated!"})
        back()
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Edit Role</ModalTitle>
      <ModalSubtitle>in <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <RoleForm {loading} {onSubmit} {initialValues} />
  </ModalBody>
</Modal>
