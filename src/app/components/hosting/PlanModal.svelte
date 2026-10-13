<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import PricingTable from "@app/components/hosting/PricingTable.svelte"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {pushModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"
  import {
    hosting,
    hostingErrorMessage,
    isPaidPlan,
    updateRelay,
    type HostedRelay,
  } from "@app/features/hosting"

  type Props = {
    relay: HostedRelay
  }

  const {relay}: Props = $props()

  const plans = $hosting.plans

  let selected = $state(relay.plan_id)
  let saving = $state(false)

  const canSave = $derived(!saving && selected !== relay.plan_id)

  const back = () => history.back()

  const selectPlan = (id: string) => {
    selected = id
  }

  const save = async () => {
    if (canSave) {
      saving = true

      try {
        // Leaving the paid plans turns off the features only they include.
        const updated = await updateRelay(
          relay.id,
          isPaidPlan(selected)
            ? {plan_id: selected}
            : {plan_id: selected, blossom_enabled: 0, livekit_enabled: 0},
        )

        $hosting.setRelay(updated)
        pushToast({message: "Plan updated."})

        const due = isPaidPlan(selected) ? await $hosting.findPaymentDue() : undefined

        if (due?.invoice) {
          pushModal(PaymentDialog, {invoice: due.invoice}, {replaceState: true})
        } else if (due) {
          pushModal(PaymentSetup, {}, {replaceState: true})
        } else {
          back()
        }
      } catch (e) {
        pushToast({theme: "error", message: hostingErrorMessage(e, "Failed to update plan.")})
      } finally {
        saving = false
      }
    }
  }
</script>

<Modal tag="form" onsubmit={preventDefault(save)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Change plan</ModalTitle>
      <ModalSubtitle>Pick a plan for this space.</ModalSubtitle>
    </ModalHeader>
    <PricingTable plans={$plans} selectable value={selected} onSelect={selectPlan} />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={saving}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!canSave}>
      <Spinner loading={saving}>Save</Spinner>
    </Button>
  </ModalFooter>
</Modal>
