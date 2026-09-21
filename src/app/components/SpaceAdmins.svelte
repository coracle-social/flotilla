<script lang="ts">
  import {onMount} from "svelte"
  import {Relays} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import SpaceMemberMethods from "@app/components/SpaceMemberMethods.svelte"
  import {fromApp} from "@app/core"
  import {
    deriveSpaceMethodAssignees,
    deriveSpaceSupportedMethods,
    displayManagementMethod,
    loadSpaceMethodAssignees,
  } from "@app/management"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = fromApp($app => $app.use(Relays).one(url))
  const assignees = deriveSpaceMethodAssignees(url)
  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canEdit = $derived(
    ["assignmethod", "unassignmethod"].some(method => $supportedMethods.includes(method)),
  )

  const back = () => history.back()

  const editMethods = (pubkey: string) => pushModal(SpaceMemberMethods, {url, pubkey})

  let loading = $state(true)

  onMount(async () => {
    const error = await loadSpaceMethodAssignees(url)

    if (error) {
      pushToast({theme: "error", message: error})
    }

    loading = false
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Admins</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#if $relay?.pubkey}
        <div class="card flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <Profile pubkey={$relay.pubkey} {url} />
          </div>
          <Badge>Owner</Badge>
        </div>
      {/if}
      {#if loading}
        <Spinner loading>Loading admins...</Spinner>
      {:else if $assignees.length === 0}
        <div class="card bg-surface p-4 text-sm opacity-70">
          Nobody else has been given management permissions.
        </div>
      {:else}
        {#each $assignees as { pubkey, methods } (pubkey)}
          <div class="card flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <Profile {pubkey} {url} />
              </div>
              {#if canEdit}
                <Button
                  class="button button-ghost button-sm button-square"
                  aria-label="Edit permissions"
                  onclick={() => editMethods(pubkey)}>
                  <Icon size={4} icon={Pen} />
                </Button>
              {/if}
            </div>
            <div class="flex flex-wrap gap-1">
              {#each methods as method (method)}
                <Badge class="badge-sm font-normal">{displayManagementMethod(method)}</Badge>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
