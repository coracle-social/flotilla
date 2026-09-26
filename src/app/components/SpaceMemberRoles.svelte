<script lang="ts">
  import {get} from "svelte/store"
  import {sortBy} from "@welshman/lib"
  import {RelayRoles} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoleItem from "@app/components/RoleItem.svelte"
  import SpaceRoles from "@app/components/SpaceRoles.svelte"
  import {app, profiles, relayManagement} from "@app/core"
  import {deriveSpacePermissions, syncAssignments} from "@app/management"
  import {deriveSpaceMemberRoles} from "@app/roles"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pubkey: string
  }

  const {url, pubkey}: Props = $props()

  const relayRoles = $app.use(RelayRoles).forUrl(url).$
  const roles = $derived(sortBy(role => [role.order(), role.label() ?? ""], $relayRoles))

  const profileDisplay = $profiles.display(pubkey, [url]).$
  const memberRoles = deriveSpaceMemberRoles(url)
  const initial = get(memberRoles).get(pubkey) ?? []
  const permissions = deriveSpacePermissions(url)

  const back = () => history.back()

  const manageRoles = () => pushModal(SpaceRoles, {url})

  const submit = async () => {
    loading = true

    try {
      const management = $relayManagement.forUrl(url)
      const error = await syncAssignments(
        initial,
        selected,
        id => management.assignRole(pubkey, id),
        id => management.unassignRole(pubkey, id),
      )

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Roles updated!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update roles."})
    } finally {
      loading = false
    }
  }

  let selected = $state([...initial])
  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Edit Member</ModalTitle>
      <ModalSubtitle>
        Manage roles for <span class="text-primary">@{$profileDisplay}</span>
      </ModalSubtitle>
    </ModalHeader>
    {#if roles.length === 0}
      <div class="card bg-surface p-4 text-sm opacity-70">This space has no roles yet.</div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each roles as role (role.identifier())}
          <label class="card card-sm flex justify-between cursor-pointer gap-3">
            <RoleItem {role} />
            <input
              type="checkbox"
              class="checkbox"
              value={role.identifier() ?? ""}
              bind:group={selected} />
          </label>
        {/each}
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if roles.length > 0}
      <Button class="button button-primary" onclick={submit} disabled={loading}>
        <Spinner {loading}>Save changes</Spinner>
      </Button>
    {:else if $permissions.manageRoles}
      <Button class="button button-primary" onclick={manageRoles}>
        <Icon icon={UsersGroup} />
        Manage Roles
      </Button>
    {/if}
  </ModalFooter>
</Modal>
