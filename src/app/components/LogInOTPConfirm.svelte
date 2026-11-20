<script lang="ts">
  import {uniq} from "@welshman/lib"
  import {Client} from "@pomade/core"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import StringMultiInput from "@lib/components/StringMultiInput.svelte"
  import LogInSelect from "@app/components/LogInSelect.svelte"
  import {clearModals, pushModal} from "@app/navigation/dialogs"
  import {selectPomadeLogin} from "@app/core/pomade"
  import {getPomadeLoginFailureMessage, POMADE_NETWORK_ERROR_MESSAGE} from "@app/core/pomade"
  import {pushToast} from "@app/navigation/toast"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    email: string
    peersByPrefix: Map<string, string>
  }

  const {email, peersByPrefix}: Props = $props()

  const back = () => history.back()

  const {loading, submit: onSubmit} = trackSubmit(
    () => POMADE_NETWORK_ERROR_MESSAGE,
    async () => {
      const {ok, options, messages, clientSecret} = await Client.loginWithChallenge(
        email,
        peersByPrefix,
        otps,
      )

      if (!ok || options.length === 0) {
        console.error(messages)

        return pushToast({
          theme: "error",
          message: getPomadeLoginFailureMessage(messages),
        })
      }

      if (uniq(options.map(o => o.pubkey)).length > 1) {
        pushModal(LogInSelect, {email, options, clientSecret})
      } else {
        const res = await selectPomadeLogin(clientSecret, options[0], email)

        if (res.ok) {
          clearModals()
        } else {
          console.error(res.messages)

          pushToast({
            theme: "error",
            message: getPomadeLoginFailureMessage(res.messages),
          })
        }
      }
    },
  )

  let otps = $state<string[]>([])
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Log In</ModalTitle>
      <ModalSubtitle>Enter the login codes sent to your email</ModalSubtitle>
    </ModalHeader>
    <p>Your login codes have been sent!</p>
    <p>
      For security reasons, you may receive three or more emails with login codes in them. Please
      paste <strong>all</strong> login codes into the text box below.
    </p>
    <StringMultiInput bind:value={otps} placeholder="Enter your login codes..." />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={$loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$loading || otps.length < 3}>
      <Spinner loading={$loading}>Log In</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
