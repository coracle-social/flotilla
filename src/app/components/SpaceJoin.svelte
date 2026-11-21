<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import SpaceJoinNotifications from "@app/components/SpaceJoinNotifications.svelte"
  import SpaceJoinStatus from "@app/components/SpaceJoinStatus.svelte"
  import {
    addSpace,
    deriveSpaceStep,
    displayRefusal,
    joinRefusals,
    joinSpace,
  } from "@app/tools/spaces"
  import {clearModals, pushModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"
  import {goToSpace} from "@app/navigation/history"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const step = deriveSpaceStep(url)

  const back = () => history.back()

  const welcome = async () => {
    pushToast({message: "Welcome to the space!"})
    await goToSpace(url, {replaceState: true})
  }

  const {loading, submit: join} = trackSubmit(
    () => "Failed to join space. Please try again.",
    async () => {
      if (needsInvite) {
        pushModal(SpaceAccessRequest, {url, callback: back})
      } else if (add) {
        await addSpace(url, notifications)
        await welcome()
      } else {
        const joinRefusal = await joinSpace(url, {notifications})

        if (!joinRefusal) {
          await welcome()
        }
      }
    },
  )

  let notifications = $state(true)

  const add = $derived($step.step === "add")
  const refusal = $derived($joinRefusals[url])
  const needsInvite = $derived(refusal?.kind === "claim" || refusal?.kind === "rejected")

  // A refusal can change what the space asks for, and the layout prompts for that instead.
  $effect(() => {
    if (["moved", "refused", "unreachable", "untrusted", "pay", "waiting"].includes($step.step)) {
      clearModals()
    }
  })
</script>

<Modal label="Join space" tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    <RelaySummary {url} />
    <SpaceJoinNotifications bind:notifications />
    {#if refusal}
      <SpaceJoinStatus error={displayRefusal(refusal)} />
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={$loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$loading}>
      <Spinner loading={$loading}>
        {needsInvite ? "Request Access" : "Join Space"}
      </Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
