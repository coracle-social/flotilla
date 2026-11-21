<script lang="ts">
  import {maybe} from "@welshman/lib"
  import {Relays} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Refresh from "@assets/icons/refresh.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import SpacePrice from "@app/components/SpacePrice.svelte"
  import {fromApp} from "@app/core/app"
  import {ENABLE_PAID_SPACES} from "@app/core/env"
  import {deriveSpaceStep, payForSpace, reconcileSpace} from "@app/tools/spaces"
  import {clearModals, pushModal} from "@app/navigation/dialogs"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = fromApp($app => $app.use(Relays).one(url))

  const step = deriveSpaceStep(url)

  const back = () => history.back()

  const requestAccess = () => pushModal(SpaceAccessRequest, {url, callback: clearModals})

  const join = async () => {
    error = await payForSpace(url)
  }

  const {loading: reconciling, submit: reconcile} = trackSubmit(
    () => "Could not check your membership. Please try again.",
    () => reconcileSpace(url),
  )

  let error = $state(maybe<string>())

  const paymentsUrl = $derived($relay?.payments_url)
  const pending = $derived($step.step !== "pay")

  // Once the space asks for something other than payment, the layout prompts for it.
  $effect(() => {
    if (!["pay", "waiting"].includes($step.step)) {
      clearModals()
    }
  })
</script>

<Modal label="Paid space">
  <ModalBody>
    <RelaySummary {url} />
    {#if ENABLE_PAID_SPACES}
      <div class="card flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-2">
          <strong>Membership</strong>
          <SpacePrice {url} class="text-xl" />
        </div>
        {#if paymentsUrl}
          <p class="text-sm text-content-subtle">
            Paid on {new URL(paymentsUrl).host}
          </p>
        {/if}
        {#if $relay?.pubkey}
          <div class="flex items-center gap-2 text-sm">
            <span class="text-content-subtle">Charged by</span>
            <Profile pubkey={$relay.pubkey} />
          </div>
        {/if}
      </div>
      <Button class="button button-link self-start" onclick={requestAccess}>
        <Icon icon={LinkRound} />
        I have an invite code
      </Button>
    {:else}
      <p>This space requires a paid membership.</p>
    {/if}
    {#if error}
      <p class="text-error">{error}</p>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if ENABLE_PAID_SPACES}
      {#if pending}
        <Button class="button button-neutral" onclick={reconcile} disabled={$reconciling}>
          <Spinner loading={$reconciling}>
            <Icon icon={Refresh} />
            Waiting for payment…
          </Spinner>
        </Button>
      {:else}
        <Button class="button button-primary" onclick={join}>
          Join Space
          <Icon icon={AltArrowRight} />
        </Button>
      {/if}
    {:else}
      <Button class="button button-primary" onclick={requestAccess}>
        <Icon icon={LinkRound} />
        I have an invite code
      </Button>
    {/if}
  </ModalFooter>
</Modal>
