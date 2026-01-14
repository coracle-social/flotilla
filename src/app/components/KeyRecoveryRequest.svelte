<script lang="ts">
  import {Client} from "@pomade/core"
  import type {SessionPomade} from "@welshman/app"
  import {session} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {pushModal} from "@app/util/modal"
  import KeyRecoveryConfirm from "@app/components/KeyRecoveryConfirm.svelte"

  const {
    email,
    clientOptions: {peers},
  } = $session as SessionPomade

  const requestRecovery = async () => {
    const {peersByPrefix} = await Client.requestChallenge(email, peers)

    pushModal(KeyRecoveryConfirm, {peersByPrefix})
  }

  const submit = async () => {
    loading = true

    try {
      await requestRecovery()
    } finally {
      loading = false
    }
  }

  const back = () => history.back()

  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(submit)}>
  <ModalHeader>
    {#snippet title()}
      Recover your Key
    {/snippet}
    {#snippet info()}
      Take control over your cryptographic identity
    {/snippet}
  </ModalHeader>
  <p>
    When you signed up, your Nostr secret key was split into multiple pieces and stored on separate
    third-party servers to keep it safe.
  </p>
  <p>
    If you're ready to take control of your cryptographic identity, click below. We'll confirm your
    email by sending you some recovery codes.
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Request recovery</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
