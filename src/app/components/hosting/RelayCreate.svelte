<script lang="ts">
  import RelayForm, {type RelayFormValues} from "@app/components/hosting/RelayForm.svelte"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {roomLists} from "@app/core"
  import {navigate, pushModal} from "@app/modal"
  import {publishRoomList} from "@app/rooms"
  import {makeSpacePath} from "@app/routes"
  import {pushToast} from "@app/toast"
  import {
    createHostedRelay,
    getHostedRelayUrl,
    hosting,
    hostingErrorMessage,
    isPaidPlan,
  } from "@app/hosting"

  // The space exists by now, so a failed billing check mustn't keep the user on the create form.
  const onPaymentLookupError = (e: unknown) => {
    pushToast({
      theme: "error",
      message: hostingErrorMessage(
        e,
        "Your space was created, but its billing couldn't be checked.",
      ),
    })

    return undefined
  }

  const submit = async (values: RelayFormValues) => {
    const relay = await createHostedRelay(values)
    const url = getHostedRelayUrl(relay)

    $hosting.setRelay(relay)

    // Join the space now, or the space layout prompts for it and displaces the payment modals.
    await $roomLists.addRelay(url).then(publishRoomList)

    const due = isPaidPlan(values.plan_id)
      ? await $hosting.findPaymentDue().catch(onPaymentLookupError)
      : undefined

    await navigate(makeSpacePath(url, "admin"), {replaceState: true})

    if (due?.invoice) {
      pushModal(PaymentDialog, {invoice: due.invoice})
    } else if (due) {
      pushModal(PaymentSetup)
    }
  }
</script>

<RelayForm mode="create" submitLabel="Create Space" onSubmit={submit} />
