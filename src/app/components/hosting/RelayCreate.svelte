<script lang="ts">
  import {publish} from "@welshman/app"
  import RelayForm, {type RelayFormValues} from "@app/components/hosting/RelayForm.svelte"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {roomLists} from "@app/core"
  import {navigate, pushModal} from "@app/modal"
  import {makeSpacePath} from "@app/routes"
  import {createHostedRelay, getHostedRelayUrl, hosting, isPaidPlan} from "@app/hosting"

  const submit = async (values: RelayFormValues) => {
    const relay = await createHostedRelay(values)
    const url = getHostedRelayUrl(relay)

    $hosting.setRelay(relay)

    // Join the space now, or the space layout prompts for it and displaces the payment modals.
    await $roomLists.addRelay(url).then(publish)

    const due = isPaidPlan(values.plan_id) ? await $hosting.findPaymentDue() : undefined

    await navigate(makeSpacePath(url, "admin"), {replaceState: true})

    if (due?.invoice) {
      pushModal(PaymentDialog, {invoice: due.invoice})
    } else if (due) {
      pushModal(PaymentSetup)
    }
  }
</script>

<RelayForm mode="create" submitLabel="Create Space" onSubmit={submit} />
