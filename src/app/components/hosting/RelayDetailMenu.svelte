<script lang="ts">
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Power from "@assets/icons/power.svg?dataurl"
  import Play from "@assets/icons/play.svg?dataurl"
  import BillList from "@assets/icons/bill-list.svg?dataurl"
  import Database from "@assets/icons/database.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import DataTransferModal from "@app/components/hosting/DataTransferModal.svelte"
  import PlanModal from "@app/components/hosting/PlanModal.svelte"
  import RelayForm from "@app/components/hosting/RelayForm.svelte"
  import type {RelayFormValues} from "@app/components/hosting/RelayForm.svelte"
  import {pushModal, clearModals} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {
    followHostedRelay,
    hosting,
    hostingErrorMessage,
    updateRelay,
    getRelay,
    deactivateRelay,
    reactivateRelay,
    type HostedRelay,
  } from "@app/hosting"

  type Props = {
    relay: HostedRelay
    onClick: () => void
  }

  const {relay, onClick}: Props = $props()

  const relayLabel = $derived(relay.info_name || relay.subdomain)

  const openPlan = () => pushModal(PlanModal, {relay}, {size: "large"})

  const openEdit = () => {
    const previous = relay
    const initialValues: RelayFormValues = {
      info_name: relay.info_name,
      subdomain: relay.subdomain,
      info_icon: relay.info_icon,
      info_description: relay.info_description,
      plan_id: relay.plan_id,
    }

    pushModal(RelayForm, {
      mode: "edit",
      initialValues,
      zooidDomain: relay.zooid_domain,
      onSubmit: async (values: RelayFormValues) => {
        const updated = await updateRelay(previous.id, values)

        clearModals()

        await followHostedRelay(previous, updated)
      },
    })
  }

  const openDataTransfer = () => {
    pushModal(DataTransferModal, {relay})
  }

  const requestDeactivate = () => {
    pushModal(Confirm, {
      title: "Deactivate relay?",
      subtitle: `${relayLabel} will be taken offline immediately.`,
      message:
        "All client connections are dropped and members can't read or write, but all data and settings are preserved. You can reactivate at any time.",
      confirm: async () => {
        try {
          await deactivateRelay(relay.id)
          $hosting.setRelay(await getRelay(relay.id))
          clearModals()
        } catch (e) {
          pushToast({
            theme: "error",
            message: hostingErrorMessage(e, "Failed to deactivate relay."),
          })
        }
      },
    })
  }

  const requestReactivate = () => {
    pushModal(Confirm, {
      title: "Reactivate relay?",
      subtitle: `${relayLabel} will come back online.`,
      message: "The relay will start accepting connections again.",
      confirm: async () => {
        try {
          await reactivateRelay(relay.id)
          $hosting.setRelay(await getRelay(relay.id))
          clearModals()
        } catch (e) {
          pushToast({
            theme: "error",
            message: hostingErrorMessage(e, "Failed to reactivate relay."),
          })
        }
      },
    })
  }
</script>

<ul
  class="menu w-52 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-xl"
  onclickcapture={onClick}>
  <li>
    <Button onclick={openEdit}>
      <Icon icon={Pen} />
      Edit details
    </Button>
  </li>
  <li>
    <Button onclick={openPlan}>
      <Icon icon={BillList} />
      Change plan
    </Button>
  </li>
  <li>
    <Button onclick={openDataTransfer}>
      <Icon icon={Database} />
      Import / export data
    </Button>
  </li>
  <li>
    {#if relay.status === "active"}
      <Button class="text-error" onclick={requestDeactivate}>
        <Icon icon={Power} />
        Deactivate
      </Button>
    {:else}
      <Button class="text-primary" onclick={requestReactivate}>
        <Icon icon={Play} />
        Reactivate
      </Button>
    {/if}
  </li>
</ul>
