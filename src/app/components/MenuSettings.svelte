<script lang="ts">
  import {Capacitor} from "@capacitor/core"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Moon from "@assets/icons/moon.svg?dataurl"
  import Settings from "@assets/icons/settings-minimalistic.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Exit from "@assets/icons/logout-3.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import {PLATFORM_NAME} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {theme} from "@app/util/theme"

  const logout = () => pushModal(LogOut)

  const toggleTheme = () => theme.set($theme === "dark" ? "light" : "dark")
</script>

<Modal>
  <ModalBody>
    <div class="flex flex-col gap-2">
      <Link replaceState href="/settings/profile">
        <CardButton class="btn-neutral">
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
        <CardButton class="btn-neutral">
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
      {#if Capacitor.getPlatform() !== "ios"}
        <Link replaceState href="/settings/wallet">
          <CardButton class="btn-neutral">
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
      {/if}
      <Link replaceState href="/settings/relays">
        <CardButton class="btn-neutral">
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
        <CardButton class="btn-neutral">
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
      <Button onclick={toggleTheme}>
        <CardButton class="btn-neutral">
          {#snippet icon()}
            <div><Icon icon={Moon} size={7} /></div>
          {/snippet}
          {#snippet title()}
            <div>Theme</div>
          {/snippet}
          {#snippet info()}
            <div>Switch between light and dark mode</div>
          {/snippet}
        </CardButton>
      </Button>
      <Link replaceState href="/settings/about">
        <CardButton class="btn-neutral">
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
  </ModalBody>
</Modal>
