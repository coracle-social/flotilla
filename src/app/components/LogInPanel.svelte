<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    title: string
    message: string
  }

  const {title, message}: Props = $props()

  const logIn = () => pushModal(LogIn)
</script>

<div class="py-20">
  <div class="card m-auto flex max-w-md flex-col items-center gap-6 text-center">
    <div class="flex flex-col gap-2">
      <strong class="text-lg">{title}</strong>
      <p class="opacity-75">{message}</p>
    </div>
    <Button class="button button-primary" onclick={logIn}>Log in</Button>
  </div>
</div>
