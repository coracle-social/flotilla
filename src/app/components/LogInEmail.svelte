<script lang="ts">
  import {Client} from "@pomade/core"
  import {uniq} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import LogInOTP from "@app/components/LogInOTP.svelte"
  import LogInSelect from "@app/components/LogInSelect.svelte"
  import {selectPomadeLogin} from "@app/core/pomade"
  import {getPomadeLoginFailureMessage, POMADE_NETWORK_ERROR_MESSAGE} from "@app/core/pomade"
  import {clearModals, pushModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    email?: string
    onLogin?: () => unknown
  }

  let {email = $bindable(""), onLogin}: Props = $props()

  const back = () => history.back()

  const loginWithOTP = () => pushModal(LogInOTP, {email, onLogin})

  const {loading, submit: onSubmit} = trackSubmit(
    () => POMADE_NETWORK_ERROR_MESSAGE,
    async () => {
      const {ok, options, messages, clientSecret} = await Client.loginWithPassword(email, password)

      if (!ok || options.length === 0) {
        console.error(messages)

        return pushToast({
          theme: "error",
          message: getPomadeLoginFailureMessage(messages),
        })
      }

      if (uniq(options.map(o => o.pubkey)).length > 1) {
        pushModal(LogInSelect, {email, options, clientSecret, onLogin})
      } else {
        const res = await selectPomadeLogin(clientSecret, options[0], email)

        if (res.ok) {
          await clearModals()
          onLogin?.()
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

  let password = $state("")
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Log In</ModalTitle>
      <ModalSubtitle>Log in using your email and password</ModalSubtitle>
    </ModalHeader>
    <FieldInline>
      {#snippet label()}
        <p>Email*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-group flex w-full items-center gap-2">
          <Icon icon={Letter} />
          <input type="email" bind:value={email} />
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Password*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-group flex w-full items-center gap-2">
          <Icon icon={Key} />
          <input type="password" bind:value={password} />
        </label>
      {/snippet}
    </FieldInline>
    <p class="text-sm">
      Forgot your password? <Button class="link" onclick={loginWithOTP}
        >Log in with a one-time access code</Button
      >.
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={$loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$loading || !email || !password}>
      <Spinner loading={$loading}>Log in</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
