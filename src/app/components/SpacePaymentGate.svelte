<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {maybe} from "@welshman/lib"
  import {Relays} from "@welshman/app"
  import {App} from "@capacitor/app"
  import {Capacitor} from "@capacitor/core"
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
  import {openCheckout, pendingCheckouts, reconcileSpaceMembership} from "@app/features/access"
  import {fromApp} from "@app/core/app"
  import {ENABLE_PAID_SPACES} from "@app/core/env"
  import {clearModals, pushModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"
  import {goToSpace} from "@app/ui/routes"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = fromApp($app => $app.use(Relays).one(url))

  const back = () => history.back()

  const requestAccess = () => pushModal(SpaceAccessRequest, {url, callback: clearModals})

  const join = () => {
    error = openCheckout(url)
  }

  // A foreground event and the poll can land at once, so this guards itself.
  const reconcile = async () => {
    if (reconciling) {
      return
    }

    reconciling = true

    try {
      if (await reconcileSpaceMembership(url)) {
        pushToast({message: "Welcome to the space!"})
        clearModals()
        await goToSpace(url, {replaceState: true})
      }
    } catch (e) {
      console.error("Failed to reconcile a space membership:", e)
      pushToast({theme: "error", message: "Could not check your membership. Please try again."})
    } finally {
      reconciling = false
    }
  }

  // Each pass reconnects to the relay, so it is worth it only while a checkout is out.
  const poll = () => {
    timer = window.setTimeout(async () => {
      await reconcile()

      // Ten minutes, after which a payment is only noticed on a foreground event.
      if (pending && ++polls < 120) {
        poll()
      }
    }, 5000)
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      reconcile()
    }
  }

  let error = $state(maybe<string>())
  let reconciling = $state(false)
  let polls = 0
  let timer = 0
  let listeners: {remove: () => void}[] = []

  const paymentsUrl = $derived($relay?.payments_url)
  const pending = $derived($pendingCheckouts.includes(url))

  $effect(() => {
    if (pending) {
      poll()

      return () => clearTimeout(timer)
    }
  })

  onMount(async () => {
    await reconcile()

    if (Capacitor.isNativePlatform()) {
      listeners = [await App.addListener("appStateChange", ({isActive}) => isActive && reconcile())]
    } else {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }
  })

  onDestroy(() => {
    clearTimeout(timer)
    listeners.forEach(listener => listener.remove())
    document.removeEventListener("visibilitychange", onVisibilityChange)
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
    <div class="flex flex-wrap justify-end gap-2">
      <Button class="button button-neutral" onclick={requestAccess}>
        <Icon icon={LinkRound} />
        I have an invite code
      </Button>
      {#if ENABLE_PAID_SPACES}
        {#if pending}
          <Button class="button button-neutral" onclick={reconcile} disabled={reconciling}>
            <Spinner loading={reconciling}>
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
      {/if}
    </div>
  </ModalFooter>
</Modal>
