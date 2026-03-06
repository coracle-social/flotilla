<script lang="ts">
  import {uniq} from "@welshman/lib"
  import {Client} from "@pomade/core"
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
  import {deleteDeactivatedPomadeSessions, loginWithPomade} from "@app/util/pomade"
  import {pushModal, clearModals} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"

  interface Props {
    email?: string
  }

  let {email = $bindable("")}: Props = $props()

  const back = () => history.back()

  const loginWithOTP = () => pushModal(LogInOTP, {email})

  const onSubmit = async () => {
    loading = true

    try {
      const {ok, options, messages, clientSecret} = await Client.loginWithPassword(email, password)

      if (!ok || options.length === 0) {
        console.error(messages)

        return pushToast({
          theme: "error",
          message: "Sorry, we were unable to log you in.",
        })
      }

      if (uniq(options.map(o => o.pubkey)).length > 1) {
        pushModal(LogInSelect, {email, options, clientSecret})
      } else {
        const {client, peers} = options[0]
        const {clientOptions, ...res} = await Client.selectLogin(clientSecret, client, peers)

        if (res.ok && clientOptions) {
          loginWithPomade(clientOptions, email)
          deleteDeactivatedPomadeSessions()
          setChecked("*")
          clearModals()
        } else {
          console.error(res.messages)

          pushToast({
            theme: "error",
            message: "Sorry, we were unable to log you in.",
          })
        }
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
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
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={Letter} />
          <input bind:value={email} />
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Password*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
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
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading || !email || !password}>
      <Spinner {loading}>Log in</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
