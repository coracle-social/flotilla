<script lang="ts">
  import {maybe} from "@welshman/lib"
  import {Relays} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import SpacePrice from "@app/components/SpacePrice.svelte"
  import {fromApp} from "@app/core/app"
  import {ENABLE_PAID_SPACES} from "@app/core/env"
  import {deriveSpaceStep, payForSpace} from "@app/tools/spaces"
  import {clearModals, pushModal} from "@app/navigation/dialogs"

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

  let error = $state(maybe<string>())

  const paymentsUrl = $derived($relay?.payments_url)

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
        <div class="flex flex-wrap items-baseline justify-between gap-x-2">
          <strong>Membership</strong>
          <SpacePrice {url} class="text-xl whitespace-nowrap" />
        </div>
        {#if paymentsUrl}
          <p class="text-sm text-content-subtle">
            Paid on {new URL(paymentsUrl).host}
          </p>
        {/if}
        {#if $relay?.pubkey}
          <p class="text-sm text-content-subtle">
            Charged by <ProfileLink pubkey={$relay.pubkey} {url} />
          </p>
        {/if}
        {#if $step.step === "waiting"}
          <Spinner size="sm" class="text-sm text-content-subtle">
            Waiting for your payment to arrive…
          </Spinner>
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
      <Button class="button button-primary" onclick={join}>
        Join Space
        <Icon icon={AltArrowRight} />
      </Button>
    {:else}
      <Button class="button button-primary" onclick={requestAccess}>
        <Icon icon={LinkRound} />
        I have an invite code
      </Button>
    {/if}
  </ModalFooter>
</Modal>
