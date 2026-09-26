<script lang="ts">
  import cx from "classnames"
  import {spec} from "@welshman/lib"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import VerifiedCheck from "@assets/icons/verified-check.svg?dataurl"
  import ShieldWarning from "@assets/icons/shield-warning.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Refresh from "@assets/icons/refresh.svg?dataurl"
  import {ucFirst} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ToggleInput from "@lib/components/ToggleInput.svelte"
  import Tooltip from "@lib/components/Tooltip.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayDetailMenu from "@app/components/hosting/RelayDetailMenu.svelte"
  import CustomDomainModal from "@app/components/hosting/CustomDomainModal.svelte"
  import {pushModal} from "@app/modal"
  import {clip, pushToast} from "@app/toast"
  import {
    RELAY_FLAG_DEFAULTS,
    flagToBool,
    boolToFlag,
    canonicalRelayHost,
    relayHost,
    followHostedRelay,
    getHostedRelayUrl,
    hosting,
    hostingErrorMessage,
    isPaidPlan,
    updateRelay,
    getRelay,
    deriveRelayMembers,
    type HostedRelay,
    type RelayFlag,
    type UpdateRelayInput,
  } from "@app/hosting"

  type Props = {
    relay: HostedRelay
  }

  const {relay}: Props = $props()

  const plans = $hosting.plans
  const members = deriveRelayMembers(relay.id)

  const host = $derived(relayHost(relay))
  const domainVerified = $derived(flagToBool(relay.custom_domain_verified, false))
  const recordTarget = $derived(canonicalRelayHost(relay))
  // DNS forbids a CNAME at a zone apex, so those use the provider's ALIAS or ANAME record.
  const isApex = $derived(relay.custom_domain.split(".").length === 2)
  const recordType = $derived(isApex ? "ALIAS" : "CNAME")
  const paidPlan = $derived(isPaidPlan(relay.plan_id))

  const setFlag = (flag: RelayFlag) => async (checked: boolean) => {
    const previous = relay
    const input: UpdateRelayInput = {[flag]: boolToFlag(checked)}

    $hosting.setRelay({...previous, ...input})

    try {
      $hosting.setRelay(await updateRelay(previous.id, input))
    } catch (e) {
      $hosting.setRelay(previous)
      pushToast({theme: "error", message: hostingErrorMessage(e, "Failed to save changes.")})
    }
  }

  const openCustomDomain = () => {
    pushModal(CustomDomainModal, {relay})
  }

  const copyTarget = () => clip(recordTarget)

  // Verification runs in a backend poller; reload to pick up the result.
  const verify = async () => {
    loading = true

    try {
      const updated = await getRelay(relay.id)

      pushToast({
        message: flagToBool(updated.custom_domain_verified, false)
          ? "Custom domain verified."
          : "Not verified yet. DNS changes can take a while to propagate.",
      })

      await followHostedRelay(relay, updated)
    } catch (e) {
      pushToast({theme: "error", message: hostingErrorMessage(e, "Verification failed.")})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

{#snippet flagToggle(title: string, flag: RelayFlag, gated = false)}
  {#snippet toggle()}
    <ToggleInput
      checked={flagToBool(relay[flag], Boolean(RELAY_FLAG_DEFAULTS[flag]))}
      disabled={gated}
      onchange={setFlag(flag)} />
  {/snippet}
  <FieldInline class={cx({"opacity-50": gated})}>
    {#snippet label()}
      <span>{title}</span>
    {/snippet}
    {#snippet input()}
      {#if gated}
        <!-- On a wrapper rather than the input, so it still shows while the toggle is disabled -->
        <Tooltip content="Not available on your current plan">
          {@render toggle()}
        </Tooltip>
      {:else}
        {@render toggle()}
      {/if}
    {/snippet}
  </FieldInline>
{/snippet}

<div class="card flex flex-col gap-6">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-4">
      <RelayIcon url={getHostedRelayUrl(relay)} icon={relay.info_icon} size={12} />
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-bold">{relay.info_name || relay.subdomain}</h2>
          <span
            class={cx("badge", {
              "badge-primary": relay.status === "active",
              "badge-neutral": relay.status !== "active",
            })}>
            {ucFirst(relay.status.replace(/_/g, " "))}
          </span>
          <span
            class={cx("badge", {
              "badge-neutral": relay.plan_id === "free",
              "badge-primary": relay.plan_id !== "free",
            })}>
            {ucFirst(relay.plan_id)}
          </span>
        </div>
        <Link external href={`https://${host}`} class="break-all text-sm text-primary">
          wss://{host}
        </Link>
        {#if relay.info_description.trim()}
          <p class="mt-2 text-sm text-content-muted">{relay.info_description}</p>
        {/if}
      </div>
    </div>

    <MenuButton
      class="button button-neutral button-circle"
      aria-label="Relay actions"
      component={RelayDetailMenu}
      componentProps={{relay}} />
  </div>

  {#if relay.sync_error}
    <div class="flex flex-col gap-1 rounded-2xl border border-error bg-surface-less p-4">
      <p class="flex items-center gap-2 text-sm font-semibold text-error">
        <Icon icon={Danger} size={4} />
        Provisioning error
      </p>
      <p class="break-all font-mono text-sm text-error">{relay.sync_error}</p>
    </div>
  {/if}

  <Divider />

  <div class="flex flex-col gap-3">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Custom Domain</h3>
    <div class="flex items-center justify-between gap-2">
      {#if relay.custom_domain}
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate font-medium">{relay.custom_domain}</span>
          {#if domainVerified}
            <span class="badge badge-primary">
              <Icon icon={VerifiedCheck} size={3} />
              Verified
            </span>
          {:else}
            <span class="badge badge-warning">
              <Icon icon={ShieldWarning} size={3} />
              Pending
            </span>
          {/if}
        </div>
        <Button class="button button-neutral button-sm shrink-0" onclick={openCustomDomain}>
          Manage
        </Button>
      {:else}
        <span class="text-sm text-content-muted">Not configured</span>
        <Button class="button button-neutral button-sm shrink-0" onclick={openCustomDomain}>
          Add domain
        </Button>
      {/if}
    </div>
    {#if relay.custom_domain && !domainVerified}
      <div class="flex flex-col gap-3 rounded-2xl border border-warning bg-surface-less p-4">
        <div class="flex items-start gap-2">
          <Icon icon={ShieldWarning} size={4} class="mt-0.5 shrink-0 text-warning" />
          <p class="text-sm font-semibold text-warning">
            Not yet verified — add this DNS record, then verify.
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <code class="min-w-0 flex-1 break-all font-mono text-xs text-content">
            {relay.custom_domain}
            {recordType}
            {recordTarget}
          </code>
          <Button
            class="button button-neutral button-sm shrink-0"
            data-tip="Copy {recordType} target"
            onclick={copyTarget}>
            <Icon icon={Copy} size={4} />
          </Button>
        </div>
        {#if isApex}
          <p class="text-xs text-content-muted">
            A bare domain can't use a CNAME. Your provider may call this record ANAME, or offer
            CNAME flattening instead.
          </p>
        {/if}
        <Button
          class="button button-neutral button-sm self-start"
          onclick={verify}
          disabled={loading}>
          {#if !loading}
            <Icon icon={Refresh} size={4} />
          {/if}
          <Spinner {loading} size="sm">Verify DNS record</Spinner>
        </Button>
      </div>
    {/if}
  </div>

  <Divider />

  <div class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Policy</h3>
    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {@render flagToggle("Public read", "policy_public_read")}
      {@render flagToggle("Public write", "policy_public_write")}
      {@render flagToggle("Public join", "policy_public_join")}
      {@render flagToggle("Members can invite others", "members_can_invite")}
      {@render flagToggle("Strip signatures", "policy_strip_signatures")}
    </div>
  </div>

  <Divider />

  <div class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Features</h3>
    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {@render flagToggle("Rooms", "groups_enabled")}
      {@render flagToggle("Management API", "management_enabled")}
      {@render flagToggle("Push notifications", "push_enabled")}
      {@render flagToggle("Media storage", "blossom_enabled", !paidPlan)}
      {@render flagToggle("LiveKit support", "livekit_enabled", !paidPlan)}
    </div>
  </div>

  <Divider />

  <div class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Membership</h3>
    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <FieldInline>
        {#snippet label()}
          <span>Current members</span>
        {/snippet}
        {#snippet input()}
          <span class="font-medium">{$members.length}</span>
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Member limit</span>
        {/snippet}
        {#snippet input()}
          {@const plan = $plans.find(spec({id: relay.plan_id}))}
          <span class="font-medium">
            {typeof plan?.members === "number" ? plan.members : "∞"}
          </span>
        {/snippet}
      </FieldInline>
    </div>
  </div>

  <Divider />

  <div class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Plan</h3>
    <FieldInline>
      {#snippet label()}
        <span>Current plan</span>
      {/snippet}
      {#snippet input()}
        <span class="font-medium">{ucFirst(relay.plan_id)}</span>
      {/snippet}
    </FieldInline>
  </div>
</div>
