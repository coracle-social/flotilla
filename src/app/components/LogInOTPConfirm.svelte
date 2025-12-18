<script lang="ts">
  import {Client} from "@pomade/core"
  import {identity} from "@welshman/lib"
  import {loginWithPomade} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {clearModals} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"

  type Props = {
    email: string
  }

  const {email}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    try {
      const {ok, options, messages, clientSecret} = await Client.loginWithChallenge(
        email,
        challenges,
      )

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

  const challenges = $state(["", "", ""])

  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Log In</div>
    {/snippet}
    {#snippet info()}
      <div>Enter the one-time login code sent to your email</div>
    {/snippet}
  </ModalHeader>
  <FieldInline>
    {#snippet label()}
      <p>Login Code #1*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Key} />
        <input bind:value={challenges[0]} />
      </label>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      <p>Login Code #2*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Key} />
        <input bind:value={challenges[1]} />
      </label>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      <p>Login Code #3*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Key} />
        <input bind:value={challenges[2]} />
      </label>
    {/snippet}
  </FieldInline>
  <p class="text-sm">
    To keep your key as safe a possible, you will receive <strong>three separate emails</strong>.
    Be sure to enter all three codes!
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading || !challenges.every(identity)}>
      <Spinner {loading}>Log In</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
