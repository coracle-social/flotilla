<script lang="ts">
  import {Client} from "@pomade/core"
  import {loginWithPomade} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import LogInOTP from "@app/components/LogInOTP.svelte"
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

      if (!ok) {
        console.error(messages)

        return pushToast({
          theme: "error",
          message: "Sorry, we were unable to log you in.",
        })
      }

      const [client, peers] = options[0]!
      const {clientOptions, ...res} = await Client.selectLogin(clientSecret, client, peers)

      if (res.ok && clientOptions) {
        loginWithPomade(clientOptions.group.group_pk.slice(2), clientOptions)
        pushToast({message: "Successfully logged in!"})
        setChecked("*")
        clearModals()
      } else {
        console.error(res.messages)

        pushToast({
          theme: "error",
          message: "Sorry, we were unable to log you in.",
        })
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let password = $state("")
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Log In</div>
    {/snippet}
    {#snippet info()}
      <div>Log in using your email and password</div>
    {/snippet}
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
</form>
