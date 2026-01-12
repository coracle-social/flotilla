<script lang="ts">
  import {Client, decodeChallenge} from '@pomade/core'
  import {chunk, sleep, uniq, identity, tryCatch} from "@welshman/lib"
  import {
    makeEvent,
    createProfile,
    PROFILE,
    isReplaceable,
    getAddress,
    RelayMode,
    getPubkey,
  } from "@welshman/util"
  import type {SessionPomade} from '@welshman/app'
  import {pubkey, session, publishThunk, repository, derivePubkeyRelays} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import KeyDownload from "@app/components/KeyDownload.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal, clearModals} from "@app/util/modal"
  import {logout} from "@app/core/commands"
  import {INDEXER_RELAYS, POMADE_SIGNERS, PLATFORM_NAME, userSpaceUrls} from "@app/core/state"

  const {email, clientOptions: {secret, peers}} = $session as SessionPomade

  const requestRecovery = async () => {
    await Client.requestChallenge(email, peers)
    sent = true
  }

  const confirmRecovery = async () => {
    const challenges = input.split(/\n/).map(x => x.trim()).filter(x => tryCatch(() => decodeChallenge(x)))

    if (challenges.length < 2) {
      return pushToast({
        theme: "error",
        message: "Failed to recover, not enough valid challenges were provided."
      })
    }

    const request = await Client.recoverWithChallenge(email, challenges)

    if (!request.ok) {
      console.log(request.messages)

      return pushToast({
        theme: "error",
        message: `Failed to recover: ${request.messages[0]?.payload.message.toLowerCase()}`
      })
    }

    const result = await Client.selectRecovery(request.clientSecret, getPubkey(secret), peers)

    if (!result.ok) {
      console.log(result.messages)

      return pushToast({
        theme: "error",
        message: `Failed to recover: ${result.messages[0]?.payload.message.toLowerCase()}`
      })
    }

    pushModal(KeyDownload, {secret: result.userSecret, next: clearModals, submitText: "Done"})
  }

  const submit = async () => {
    loading = true

    try {
      if (sent) {
        await confirmRecovery()
      } else {
        await requestRecovery()
      }
    } finally {
      loading = false
    }
  }

  const back = () => history.back()

  let sent = $state(false)
  let loading = $state(false)
  let input = $state("")
  let userSecret = $state("")
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
  {#if sent}
    <p>
      Your recovery codes have been sent!
    </p>
    <p>
      For security reasons, you may receive three or more emails with recovery codes in them. Please paste <i>all</i>
      recovery codes into the text box below, on separate lines.
    </p>
    <textarea
      rows={POMADE_SIGNERS.length + 1}
      class="textarea textarea-bordered leading-4 text-xs"
      bind:value={input}></textarea>
  {:else}
    <p>
      When you signed up, your Nostr secret key was split into multiple pieces and stored on separate
      third-party servers to keep it safe.
    </p>
    <p>
      If you're ready to take control of your cryptographic identity, click below. We'll confirm your
      email by sending you some recovery codes.
    </p>
  {/if}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if sent}
      <Button type="submit" class="btn btn-primary" disabled={loading}>
        <Spinner {loading}>Confirm recovery</Spinner>
        <Icon icon={AltArrowRight} />
      </Button>
    {:else}
      <Button type="submit" class="btn btn-primary" disabled={loading}>
        <Spinner {loading}>Request recovery</Spinner>
        <Icon icon={AltArrowRight} />
      </Button>
    {/if}
  </ModalFooter>
</form>
