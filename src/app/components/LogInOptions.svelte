<script lang="ts">
  import Login from "@assets/icons/login-3.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import SignUp from "@app/components/SignUp.svelte"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    onLogin?: () => unknown
  }

  const {onLogin}: Props = $props()

  const logIn = () => pushModal(LogIn, {onLogin})

  const signUp = () => pushModal(SignUp, {onLogin})
</script>

<Button aria-label="Log in" onclick={logIn}>
  <CardButton primary>
    {#snippet icon()}
      <div><Icon icon={Login} size={7} /></div>
    {/snippet}
    {#snippet title()}
      <div>Log in</div>
    {/snippet}
    {#snippet info()}
      <div>If you've been here before, you know the drill.</div>
    {/snippet}
  </CardButton>
</Button>
<Button onclick={signUp}>
  <CardButton>
    {#snippet icon()}
      <div><Icon icon={AddCircle} size={7} /></div>
    {/snippet}
    {#snippet title()}
      <div>Create an account</div>
    {/snippet}
    {#snippet info()}
      <div>Just a few questions and you'll be on your way.</div>
    {/snippet}
  </CardButton>
</Button>
