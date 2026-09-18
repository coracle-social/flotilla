<script lang="ts">
  import {sortBy} from "@welshman/lib"
  import {RelayRoles} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoleCreate from "@app/components/RoleCreate.svelte"
  import RoleItem from "@app/components/RoleItem.svelte"
  import SpaceRoleMenu from "@app/components/SpaceRoleMenu.svelte"
  import {app} from "@app/core"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relayRoles = $app.use(RelayRoles).forUrl(url).$
  const roles = $derived(sortBy(role => [role.order(), role.label() ?? ""], $relayRoles))

  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canCreate = $derived($supportedMethods.includes("createrole"))
  const canEdit = $derived($supportedMethods.includes("editrole"))
  const canDelete = $derived($supportedMethods.includes("deleterole"))
  const canAssign = $derived($supportedMethods.includes("assignrole"))

  const back = () => history.back()

  const createRole = () => pushModal(RoleCreate, {url})
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Manage Roles</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    {#if roles.length === 0}
      <div class="card bg-surface p-4 text-sm opacity-70">
        No roles yet. Create one to start organizing members.
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each roles as role (role.identifier())}
          <div class="card card-sm flex justify-between gap-2">
            <RoleItem {role} />
            {#if canEdit || canDelete || canAssign}
              <div class="shrink-0">
                <MenuButton
                  class="button button-ghost button-sm button-square"
                  component={SpaceRoleMenu}
                  componentProps={{url, role}} />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if canCreate}
      <Button class="button button-primary" onclick={createRole}>
        <Icon icon={AddCircle} />
        Create Role
      </Button>
    {/if}
  </ModalFooter>
</Modal>
