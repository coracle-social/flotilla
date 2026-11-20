<script lang="ts">
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {HIDE_NOSTR} from "@app/core/env"

  type Props = {
    signUpWithKey: () => unknown
    onClick: () => void
  }

  const {signUpWithKey, onClick}: Props = $props()
</script>

<ul class="menu bg-surface rounded-2xl p-2 whitespace-nowrap" onclickcapture={onClick}>
  <li>
    <Button onclick={signUpWithKey}>
      <Icon size={4} icon={Key} />
      {HIDE_NOSTR ? "Sign up without email" : "Generate a key"}
    </Button>
  </li>
</ul>
