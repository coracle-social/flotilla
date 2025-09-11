<script lang="ts">
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Settings from "@assets/icons/settings-minimalistic.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Exit from "@assets/icons/logout-3.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import {PLATFORM_NAME} from "@app/core/state"
  import {pushModal} from "@app/util/modal"

  const logout = () => pushModal(LogOut)
</script>

<div class="column menu gap-2">
  <Link replaceState href="/settings/profile">
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={UserRounded} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Profile</div>
      {/snippet}
      {#snippet info()}
        <div>Customize your user profile</div>
      {/snippet}
    </CardButton>
  </Link>
  <Link replaceState href="/settings/alerts">
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={Bell} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Alerts</div>
      {/snippet}
      {#snippet info()}
        <div>Set up email digests and push notifications</div>
      {/snippet}
    </CardButton>
  </Link>
  <Link replaceState href="/settings/wallet">
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={Wallet} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Wallet</div>
      {/snippet}
      {#snippet info()}
        <div>Connect a bitcoin wallet for sending social tips</div>
      {/snippet}
    </CardButton>
  </Link>
  <Link replaceState href="/settings/relays">
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={Server} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Relays</div>
      {/snippet}
      {#snippet info()}
        <div>Control how {PLATFORM_NAME} talks to the network</div>
      {/snippet}
    </CardButton>
  </Link>
  <Link replaceState href="/settings/content">
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={Settings} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Settings</div>
      {/snippet}
      {#snippet info()}
        <div>Get into the details about how {PLATFORM_NAME} works</div>
      {/snippet}
    </CardButton>
  </Link>
  <Link replaceState href="/settings/about">
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={Code2} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>About</div>
      {/snippet}
      {#snippet info()}
        <div>Learn about {PLATFORM_NAME} and support the developer</div>
      {/snippet}
    </CardButton>
  </Link>
  <Button onclick={logout} class="btn btn-neutral">
    <Icon icon={Exit} /> Log Out
  </Button>
</div>
