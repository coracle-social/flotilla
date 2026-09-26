<script lang="ts">
  import {onMount} from "svelte"
  import {get} from "svelte/store"
  import {difference, spec} from "@welshman/lib"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {profiles, relayManagement} from "@app/core"
  import {
    MANAGEMENT_METHOD_GROUPS,
    deriveSpacePermissions,
    spaceManagement,
    syncAssignments,
  } from "@app/management"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pubkey: string
  }

  const {url, pubkey}: Props = $props()

  const profileDisplay = $profiles.display(pubkey, [url]).$
  const permissions = deriveSpacePermissions(url)

  // A relay can grant methods this client doesn't know, and leaving them out would revoke them.
  const groups = $derived.by(() => {
    const known = MANAGEMENT_METHOD_GROUPS.flatMap(group => group.methods.map(({method}) => method))
    const extra = difference(assigned, known)

    if (extra.length > 0) {
      return [
        ...MANAGEMENT_METHOD_GROUPS,
        {label: "Other", methods: extra.map(method => ({method, label: method}))},
      ]
    }

    return MANAGEMENT_METHOD_GROUPS
  })

  const back = () => history.back()

  const submit = async () => {
    saving = true

    try {
      const management = $relayManagement.forUrl(url)
      const error = await syncAssignments(
        assigned,
        selected,
        method => management.assignMethod(pubkey, method),
        method => management.unassignMethod(pubkey, method),
      )

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        await $spaceManagement.loadMethodAssignees(url)

        pushToast({message: "Permissions updated!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update permissions."})
    } finally {
      saving = false
    }
  }

  let assigned: string[] = $state([])
  let selected: string[] = $state([])
  let loading = $state(true)
  let saving = $state(false)

  onMount(async () => {
    const error = await $spaceManagement.loadMethodAssignees(url)

    if (error) {
      pushToast({theme: "error", message: error})
    }

    assigned = get($spaceManagement.methodAssignees(url)).find(spec({pubkey}))?.methods ?? []
    selected = [...assigned]
    loading = false
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Edit Permissions</ModalTitle>
      <ModalSubtitle>
        Choose what <span class="text-primary">@{$profileDisplay}</span> can administer
      </ModalSubtitle>
    </ModalHeader>
    {#if loading}
      <Spinner loading>Loading permissions...</Spinner>
    {:else}
      <div class="flex flex-col gap-4">
        {#each groups as group (group.label)}
          <div class="flex flex-col gap-2">
            <strong class="text-sm opacity-70">{group.label}</strong>
            {#each group.methods as { method, label } (method)}
              <label class="card card-sm flex cursor-pointer justify-between gap-3">
                {label}
                <input
                  type="checkbox"
                  class="checkbox"
                  value={method}
                  bind:group={selected}
                  disabled={selected.includes(method)
                    ? !$permissions.unassignMethods
                    : !$permissions.assignMethods} />
              </label>
            {/each}
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
    {#if $permissions.editAdmins}
      <Button class="button button-primary" onclick={submit} disabled={saving}>
        <Spinner loading={saving}>Save changes</Spinner>
      </Button>
    {/if}
  </ModalFooter>
</Modal>
