<script lang="ts">
  import type {Nip55AppInfo} from "@welshman/signer"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Cpu from "@assets/icons/cpu-bolt.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    signers: Nip55AppInfo[]
    loginWithNip55: (signerApp: Nip55AppInfo) => () => unknown
    loginWithBunker?: () => unknown
    loginWithEmail?: () => unknown
    loginWithKey?: () => unknown
    onClick: () => void
  }

  const {signers, loginWithNip55, loginWithBunker, loginWithEmail, loginWithKey, onClick}: Props =
    $props()
</script>

<ul class="menu bg-surface rounded-2xl p-2 whitespace-nowrap" onclickcapture={onClick}>
  {#each signers as signerApp (signerApp.name)}
    <li>
      <Button onclick={loginWithNip55(signerApp)}>
        <img src={signerApp.iconUrl} alt={signerApp.name} width="16" height="16" />
        Log in with {signerApp.name}
      </Button>
    </li>
  {/each}
  {#if loginWithBunker}
    <li>
      <Button onclick={loginWithBunker}>
        <Icon size={4} icon={Cpu} />
        Log in with Remote Signer
      </Button>
    </li>
  {/if}
  {#if loginWithEmail}
    <li>
      <Button onclick={loginWithEmail}>
        <Icon size={4} icon={Letter} />
        Log in with Email
      </Button>
    </li>
  {/if}
  {#if loginWithKey}
    <li>
      <Button onclick={loginWithKey}>
        <Icon size={4} icon={Key} />
        Log in with Key
      </Button>
    </li>
  {/if}
</ul>
