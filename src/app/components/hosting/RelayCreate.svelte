<script lang="ts">
  import {publish} from "@welshman/app"
  import RelayForm, {type RelayFormValues} from "@app/components/hosting/RelayForm.svelte"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {roomLists, user} from "@app/core"
  import {navigate, pushModal} from "@app/modal"
  import {makeSpacePath} from "@app/routes"
  import {HOSTING_RELAY_DOMAIN} from "@app/env"
  import {
    autopayConfigured,
    createRelay,
    ensureSessionTenant,
    getHostedRelayUrl,
    getTenant,
    listTenantInvoices,
    reconcileTenant,
    selectPayableInvoice,
  } from "@app/hosting"

  const createRelayForActiveTenant = (values: RelayFormValues) => {
    const defaults = {
      info_name: "",
      info_icon: "",
      info_description: "",
      policy_public_read: 0,
      policy_public_write: 0,
      policy_public_join: 0,
      policy_strip_signatures: 0,
      groups_enabled: 1,
      management_enabled: 1,
      push_enabled: 1,
    }

    const overrides = {
      tenant_pubkey: $user.pubkey,
      zooid_domain: HOSTING_RELAY_DOMAIN,
      blossom_enabled: values.plan_id === "free" ? 0 : 1,
      livekit_enabled: values.plan_id === "free" ? 0 : 1,
    }

    return createRelay({...defaults, ...values, ...overrides})
  }

  const handleSubmit = async (values: RelayFormValues) => {
    await ensureSessionTenant()

    const relay = await createRelayForActiveTenant(values)
    const url = getHostedRelayUrl(relay)

    // Join the space we just made, otherwise the space layout prompts us to join
    // it, displacing the payment modals below.
    await $roomLists.addRelay(url).then(publish)
    await reconcileTenant($user.pubkey)

    const tenant = await getTenant($user.pubkey)

    await navigate(makeSpacePath(url, "admin"), {replaceState: true})

    if (values.plan_id !== "free" && !autopayConfigured(tenant)) {
      const invoice = selectPayableInvoice(await listTenantInvoices($user.pubkey))

      if (invoice) {
        pushModal(PaymentDialog, {invoice})
      } else {
        pushModal(PaymentSetup, {})
      }
    }
  }
</script>

<RelayForm mode="create" submitLabel="Create Space" onSubmit={handleSubmit} />
