<script lang="ts">
  import cx from "classnames"
  import {spec} from "@welshman/lib"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Power from "@assets/icons/power.svg?dataurl"
  import Play from "@assets/icons/play.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import VerifiedCheck from "@assets/icons/verified-check.svg?dataurl"
  import ShieldWarning from "@assets/icons/shield-warning.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Refresh from "@assets/icons/refresh.svg?dataurl"
  import BillList from "@assets/icons/bill-list.svg?dataurl"
  import Database from "@assets/icons/database.svg?dataurl"
  import {fly} from "@lib/transition"
  import {ucFirst} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ToggleInput from "@lib/components/ToggleInput.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import CustomDomainModal from "@app/components/hosting/CustomDomainModal.svelte"
  import DataTransferModal from "@app/components/hosting/DataTransferModal.svelte"
  import PlanModal from "@app/components/hosting/PlanModal.svelte"
  import {roomLists} from "@app/core"
  import RelayForm from "@app/components/hosting/RelayForm.svelte"
  import type {RelayFormValues} from "@app/components/hosting/RelayForm.svelte"
  import {pushModal, clearModals} from "@app/modal"
  import {clip, pushToast} from "@app/toast"
  import {goToMovedSpace} from "@app/routes"
  import {
    HostingError,
    flagToBool,
    boolToFlag,
    canonicalRelayHost,
    relayHost,
    getHostedRelayUrl,
    updateRelay,
    getRelay,
    deactivateRelay,
    reactivateRelay,
    derivePlans,
    deriveRelayMembers,
    type HostedRelay,
    type RelayFlag,
    type UpdateRelayInput,
  } from "@app/hosting"

  type Props = {
    relay: HostedRelay
  }

  const {relay}: Props = $props()

  const PLAN_GATED_TOOLTIP = "Not available on your current plan"

  const plans = derivePlans()
  const members = deriveRelayMembers(relay.id)

  let current = $state(relay)
  let showMenu = $state(false)
  let loading = $state(false)

  const host = $derived(relayHost(current))
  const relayLabel = $derived(current.info_name || current.subdomain)
  const domainVerified = $derived(flagToBool(current.custom_domain_verified, false))
  const cnameTarget = $derived(canonicalRelayHost(current))
  const isPaidPlan = $derived(current.plan_id !== "free")

  // Adding, removing or verifying a custom domain moves the relay's host, so
  // migrate the admin's groups list and follow the space to its new url.
  const setCurrentAndFollowHost = async (next: HostedRelay) => {
    const previousUrl = getHostedRelayUrl(current)
    const nextUrl = getHostedRelayUrl(next)

    current = next

    if (previousUrl !== nextUrl) {
      await $roomLists.migrateRelay(previousUrl, nextUrl).then(command => command?.publish())
      await goToMovedSpace(previousUrl, nextUrl)
    }
  }

  const persist = async (next: HostedRelay, input: UpdateRelayInput) => {
    const previous = current

    current = next

    try {
      current = await updateRelay(previous.id, input)
    } catch (e) {
      current = previous
      pushToast({
        theme: "error",
        message: e instanceof HostingError ? e.message : "Failed to save changes.",
      })
    }
  }

  const setFlag = (field: RelayFlag) => (checked: boolean) => {
    const input: UpdateRelayInput = {[field]: boolToFlag(checked)}

    persist({...current, ...input}, input)
  }

  const setCurrent = (next: HostedRelay) => {
    current = next
  }

  const openPlan = () =>
    pushModal(PlanModal, {relay: current, onUpdate: setCurrent}, {size: "large"})

  const openEdit = () => {
    const initialValues: RelayFormValues = {
      info_name: current.info_name,
      subdomain: current.subdomain,
      info_icon: current.info_icon,
      info_description: current.info_description,
      plan_id: current.plan_id,
    }

    pushModal(RelayForm, {
      mode: "edit",
      initialValues,
      zooidDomain: current.zooid_domain,
      onSubmit: async (values: RelayFormValues) => {
        const updated = await updateRelay(current.id, values)

        clearModals()

        // The subdomain is editable here, so the host may have moved.
        await setCurrentAndFollowHost(updated)
      },
    })
  }

  const openDataTransfer = () => {
    pushModal(DataTransferModal, {relay: current})
  }

  const openCustomDomain = () => {
    pushModal(CustomDomainModal, {relay: current, onUpdate: setCurrentAndFollowHost})
  }

  const openMenu = () => {
    showMenu = true
  }

  const closeMenu = () => {
    showMenu = false
  }

  const copyCname = () => clip(cnameTarget)

  // Verification runs in a backend poller; reload to pick up the result.
  const verify = async () => {
    loading = true

    try {
      const updated = await getRelay(current.id)

      pushToast({
        message: flagToBool(updated.custom_domain_verified, false)
          ? "Custom domain verified."
          : "Not verified yet. DNS changes can take a while to propagate.",
      })

      await setCurrentAndFollowHost(updated)
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof HostingError ? e.message : "Verification failed.",
      })
    } finally {
      loading = false
    }
  }

  const requestDeactivate = () => {
    pushModal(Confirm, {
      title: "Deactivate relay?",
      subtitle: `${relayLabel} will be taken offline immediately.`,
      message:
        "All client connections are dropped and members can't read or write, but all data and settings are preserved. You can reactivate at any time.",
      confirm: async () => {
        try {
          await deactivateRelay(current.id)
          current = await getRelay(current.id)
          clearModals()
        } catch (e) {
          pushToast({
            theme: "error",
            message: e instanceof HostingError ? e.message : "Failed to deactivate relay.",
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
          await reactivateRelay(current.id)
          current = await getRelay(current.id)
          clearModals()
        } catch (e) {
          pushToast({
            theme: "error",
            message: e instanceof HostingError ? e.message : "Failed to reactivate relay.",
          })
        }
      },
    })
  }
</script>

<div class="card flex flex-col gap-6">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-4">
      <RelayIcon url={getHostedRelayUrl(current)} icon={current.info_icon} size={12} />
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-bold">{relayLabel}</h2>
          <Badge variant={current.status === "active" ? "primary" : "neutral"}>
            {ucFirst(current.status.replace(/_/g, " "))}
          </Badge>
          <Badge variant={current.plan_id === "free" ? "neutral" : "primary"}>
            {ucFirst(current.plan_id)}
          </Badge>
        </div>
        <Link external href={`https://${host}`} class="break-all text-sm text-primary">
          wss://{host}
        </Link>
        {#if current.info_description.trim()}
          <p class="mt-2 text-sm text-content-muted">{current.info_description}</p>
        {/if}
      </div>
    </div>

    <div class="relative shrink-0">
      <Button
        class="button button-neutral button-circle"
        aria-label="Relay actions"
        onclick={openMenu}>
        <Icon icon={MenuDots} />
      </Button>
      {#if showMenu}
        <Popover hideOnClick onClose={closeMenu}>
          <ul
            transition:fly
            class="menu absolute right-0 z-popover mt-2 w-52 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-xl">
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
              {#if current.status === "active"}
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
        </Popover>
      {/if}
    </div>
  </div>

  {#if current.sync_error}
    <div class="flex flex-col gap-1 rounded-2xl border border-error bg-surface-less p-4">
      <p class="flex items-center gap-2 text-sm font-semibold text-error">
        <Icon icon={Danger} size={4} />
        Provisioning error
      </p>
      <p class="break-all font-mono text-sm text-error">{current.sync_error}</p>
    </div>
  {/if}

  <Divider />

  <div class="flex flex-col gap-3">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Custom Domain</h3>
    <div class="flex items-center justify-between gap-2">
      {#if current.custom_domain}
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate font-medium">{current.custom_domain}</span>
          {#if domainVerified}
            <Badge variant="primary">
              <Icon icon={VerifiedCheck} size={3} />
              Verified
            </Badge>
          {:else}
            <Badge variant="warning">
              <Icon icon={ShieldWarning} size={3} />
              Pending
            </Badge>
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
    {#if current.custom_domain && !domainVerified}
      <div class="flex flex-col gap-3 rounded-2xl border border-warning bg-surface-less p-4">
        <div class="flex items-start gap-2">
          <Icon icon={ShieldWarning} size={4} class="mt-0.5 shrink-0 text-warning" />
          <p class="text-sm font-semibold text-warning">
            Not yet verified — add this DNS record, then verify.
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <code class="min-w-0 flex-1 break-all font-mono text-xs text-content">
            {current.custom_domain} CNAME {cnameTarget}
          </code>
          <Button
            class="button button-neutral button-sm shrink-0"
            data-tip="Copy CNAME target"
            onclick={copyCname}>
            <Icon icon={Copy} size={4} />
          </Button>
        </div>
        <p class="text-xs text-content-muted">
          For apex domains (e.g. example.com), use an ALIAS or ANAME record instead.
        </p>
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
      <FieldInline>
        {#snippet label()}
          <span>Public read</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.policy_public_read, false)}
            onchange={setFlag("policy_public_read")} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Public write</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.policy_public_write, false)}
            onchange={setFlag("policy_public_write")} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Public join</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.policy_public_join, false)}
            onchange={setFlag("policy_public_join")} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Members can invite others</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.members_can_invite, true)}
            onchange={setFlag("members_can_invite")} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Strip signatures</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.policy_strip_signatures, false)}
            onchange={setFlag("policy_strip_signatures")} />
        {/snippet}
      </FieldInline>
    </div>
  </div>

  <Divider />

  <div class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Features</h3>
    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <FieldInline>
        {#snippet label()}
          <span>Rooms</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.groups_enabled, true)}
            onchange={setFlag("groups_enabled")} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Management API</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.management_enabled, true)}
            onchange={setFlag("management_enabled")} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <span>Push notifications</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.push_enabled, true)}
            onchange={setFlag("push_enabled")} />
        {/snippet}
      </FieldInline>
      <FieldInline class={cx({"opacity-50": !isPaidPlan})}>
        {#snippet label()}
          <span>Media storage</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.blossom_enabled, false)}
            disabled={!isPaidPlan}
            tooltip={isPaidPlan ? undefined : PLAN_GATED_TOOLTIP}
            onchange={setFlag("blossom_enabled")} />
        {/snippet}
      </FieldInline>
      <FieldInline class={cx({"opacity-50": !isPaidPlan})}>
        {#snippet label()}
          <span>LiveKit support</span>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={flagToBool(current.livekit_enabled, false)}
            disabled={!isPaidPlan}
            tooltip={isPaidPlan ? undefined : PLAN_GATED_TOOLTIP}
            onchange={setFlag("livekit_enabled")} />
        {/snippet}
      </FieldInline>
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
          {@const plan = $plans.find(spec({id: current.plan_id}))}
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
        <span class="font-medium">{ucFirst(current.plan_id)}</span>
      {/snippet}
    </FieldInline>
  </div>
</div>
