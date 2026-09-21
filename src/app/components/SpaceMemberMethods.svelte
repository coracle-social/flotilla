<script lang="ts">
  import {onMount} from "svelte"
  import {get} from "svelte/store"
  import {spec} from "@welshman/lib"
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
    deriveSpaceMethodAssignees,
    deriveSpaceSupportedMethods,
    loadSpaceMethodAssignees,
  } from "@app/management"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pubkey: string
  }

  const {url, pubkey}: Props = $props()

  const profileDisplay = $profiles.display(pubkey, [url]).$
  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canAssign = $derived($supportedMethods.includes("assignmethod"))
  const canUnassign = $derived($supportedMethods.includes("unassignmethod"))

  // A relay can grant methods this client knows nothing about, and a list that left them out
  // would revoke them on the next save.
  const groups = $derived.by(() => {
    const known = MANAGEMENT_METHOD_GROUPS.flatMap(group => group.methods.map(({method}) => method))
    const extra = [...assigned].filter(method => !known.includes(method))

    if (extra.length > 0) {
      return [
        ...MANAGEMENT_METHOD_GROUPS,
        {label: "Other", methods: extra.map(method => ({method, label: method}))},
      ]
    }

    return MANAGEMENT_METHOD_GROUPS
  })

  const back = () => history.back()

  const toggle = (method: string) => {
    const next = new Set(selected)

    if (next.has(method)) {
      next.delete(method)
    } else {
      next.add(method)
    }

    selected = next
  }

  const submit = async () => {
    saving = true

    try {
      const management = $relayManagement.forUrl(url)

      for (const method of selected) {
        if (!assigned.has(method)) {
          const {error} = await management.assignMethod(pubkey, method)

          if (error) {
            pushToast({theme: "error", message: error})
            return
          }
        }
      }

      for (const method of assigned) {
        if (!selected.has(method)) {
          const {error} = await management.unassignMethod(pubkey, method)

          if (error) {
            pushToast({theme: "error", message: error})
            return
          }
        }
      }

      await loadSpaceMethodAssignees(url)

      pushToast({message: "Permissions updated!"})
      back()
    } finally {
      saving = false
    }
  }

  let assigned = $state(new Set<string>())
  let selected = $state(new Set<string>())
  let loading = $state(true)
  let saving = $state(false)

  onMount(async () => {
    const error = await loadSpaceMethodAssignees(url)

    if (error) {
      pushToast({theme: "error", message: error})
    }

    assigned = new Set(get(deriveSpaceMethodAssignees(url)).find(spec({pubkey}))?.methods ?? [])
    selected = new Set(assigned)
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
                  checked={selected.has(method)}
                  disabled={selected.has(method) ? !canUnassign : !canAssign}
                  onchange={() => toggle(method)} />
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
    {#if canAssign || canUnassign}
      <Button class="button button-primary" onclick={submit} disabled={saving}>
        <Spinner loading={saving}>Save changes</Spinner>
      </Button>
    {/if}
  </ModalFooter>
</Modal>
