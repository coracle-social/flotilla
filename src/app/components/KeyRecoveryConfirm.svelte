<script lang="ts">
  import {Client} from "@pomade/core"
  import {getPubkey} from "@welshman/util"
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
  import KeyDownload from "@app/components/KeyDownload.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal, clearModals} from "@app/util/modal"
  import {POMADE_SIGNERS} from "@app/core/state"

  type Props = {
    peersByPrefix: Map<string, string>
  }

  const {peersByPrefix}: Props = $props()

  const {
    email,
    clientOptions: {secret, peers},
  } = $session as SessionPomade

  const confirmRecovery = async () => {
    const otps = input
      .split(/\n/)
      .map(x => x.trim())
      .filter(x => x.match(/^[0-9]{8}$/))

    if (otps.length < 2) {
      return pushToast({
        theme: "error",
        message: "Failed to recover, not enough valid recovery codes were provided.",
      })
    }

    const request = await Client.recoverWithChallenge(email, peersByPrefix, otps)

    if (!request.ok) {
      console.log(request.messages)

      return pushToast({
        theme: "error",
        message: `Failed to recover: ${request.messages[0]?.payload.message.toLowerCase()}`,
      })
    }

    const result = await Client.selectRecovery(request.clientSecret, getPubkey(secret), peers)

    if (!result.ok) {
      console.log(result.messages)

      return pushToast({
        theme: "error",
        message: `Failed to recover: ${result.messages[0]?.payload.message.toLowerCase()}`,
      })
    }

    pushModal(KeyDownload, {secret: result.userSecret, next: clearModals, submitText: "Done"})
  }

  const submit = async () => {
    loading = true

    try {
      await confirmRecovery()
    } finally {
      loading = false
    }
  }

  const back = () => history.back()

  let loading = $state(false)
  let input = $state("")
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
  <p>Your recovery codes have been sent!</p>
  <p>
    For security reasons, you may receive three or more emails with recovery codes in them. Please
    paste <strong>all</strong> recovery codes into the text box below, on separate lines.
  </p>
  <textarea
    rows={POMADE_SIGNERS.length + 1}
    class="textarea textarea-bordered leading-4"
    bind:value={input}></textarea>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Confirm recovery</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
