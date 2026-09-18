<script lang="ts">
  import {onMount} from "svelte"
  import type {RelayRoleReader} from "@welshman/domain"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import RoleEdit from "@app/components/RoleEdit.svelte"
  import RoleAddMembers from "@app/components/RoleAddMembers.svelte"
  import {relayManagement} from "@app/core"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    role: RelayRoleReader
    onClick: () => void
  }

  const {url, role, onClick}: Props = $props()

  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canEdit = $derived($supportedMethods.includes("editrole"))
  const canDelete = $derived($supportedMethods.includes("deleterole"))
  const canAssign = $derived($supportedMethods.includes("assignrole"))

  const back = () => history.back()

  const editRole = () => pushModal(RoleEdit, {url, role})

  const addMembers = () => pushModal(RoleAddMembers, {url, role})

  const deleteRole = async () => {
    const {error} = await $relayManagement.forUrl(url).deleteRole(role.identifier() ?? "")

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "Role deleted!"})
      back()
    }
  }

  const confirmDelete = () =>
    pushModal(Confirm, {
      title: "Delete Role",
      message: `Delete the "${role.label()}" role? Members will keep their space membership.`,
      confirm: deleteRole,
    })

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  {#if canAssign}
    <li>
      <Button onclick={addMembers}>
        <Icon icon={AddCircle} />
        Add members
      </Button>
    </li>
  {/if}
  {#if canEdit}
    <li>
      <Button onclick={editRole}>
        <Icon icon={Pen} />
        Edit role
      </Button>
    </li>
  {/if}
  {#if canDelete}
    <li>
      <Button class="text-error" onclick={confirmDelete}>
        <Icon icon={TrashBin} />
        Delete role
      </Button>
    </li>
  {/if}
</ul>
