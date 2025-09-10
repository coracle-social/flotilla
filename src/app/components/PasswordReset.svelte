<script lang="ts">
  import {postJson, sleep} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
import Key from "@assets/icons/key-minimalistic.svg?dataurl"
import Icon from "@lib/components/Icon.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import LogInPassword from "@app/components/LogInPassword.svelte"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {BURROW_URL} from "@app/core/state"

  const {email, reset_token} = $props()

  const onSubmit = async () => {
    loading = true

    try {
      const [res] = await Promise.all([
        postJson(BURROW_URL + "/user/confirm-reset", {email, password, reset_token}),
        sleep(1000),
      ])

      if (res.error) {
        pushToast({message: res.error, theme: "error"})
      } else {
        pushToast({message: "Password reset successfully!"})
        pushModal(LogInPassword, {email}, {path: "/"})
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
      <div>Reset your password</div>
    {/snippet}
  </ModalHeader>
  <FieldInline disabled={loading}>
    {#snippet label()}
      <p>Email Address</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={UserRounded} />
        <input readonly value={email} class="grow" />
      </label>
    {/snippet}
  </FieldInline>
  <FieldInline disabled={loading}>
    {#snippet label()}
      <p>New Password</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Key} />
        <input bind:value={password} class="grow" type="password" />
      </label>
    {/snippet}
  </FieldInline>
  <Button type="submit" class="btn btn-primary" disabled={loading}>
    <Spinner {loading}>Reset password</Spinner>
  </Button>
</form>
