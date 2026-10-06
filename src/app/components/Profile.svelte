<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {removeUndefined} from "@welshman/lib"
  import {displayHandle} from "@welshman/util"
  import {displayPubkey} from "@welshman/domain"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import WotScore from "@app/components/WotScore.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {pushModal} from "@app/modal"
  import {clip} from "@app/toast"
  import {handles, profiles} from "@app/core"

  type Props = {
    pubkey: string
    url?: string
    showPubkey?: boolean
    avatarSize?: number
    inert?: boolean
  }

  const {pubkey, url, showPubkey, inert, avatarSize = 10}: Props = $props()

  const profileDisplay = $profiles.display(pubkey, removeUndefined([url])).$
  const handle = $handles.forPubkey(pubkey).$

  const openProfile = () => {
    pushModal(ProfileDetail, {pubkey, url})
  }

  const copyPubkey = () => clip(nip19.npubEncode(pubkey))
</script>

<div class="flex max-w-full min-w-0 items-start gap-2">
  {#if inert}
    <span class="py-1">
      <ProfileCircle {pubkey} {url} size={avatarSize} />
    </span>
  {:else}
    <Button onclick={openProfile} class="py-1">
      <ProfileCircle {pubkey} {url} size={avatarSize} />
    </Button>
  {/if}
  <div class="flex min-w-0 flex-col">
    <div class="flex min-w-0 items-center gap-2">
      {#if inert}
        <span class="text-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {$profileDisplay}
        </span>
      {:else}
        <Button
          onclick={openProfile}
          class="text-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {$profileDisplay}
        </Button>
      {/if}
      <WotScore {pubkey} />
    </div>
    {#if $handle}
      <div class="overflow-hidden text-ellipsis text-sm opacity-75">
        {displayHandle($handle)}
      </div>
    {/if}
    {#if showPubkey}
      <div class="flex items-center gap-1 overflow-hidden text-ellipsis text-xs opacity-60">
        {displayPubkey(pubkey)}
        <Button onclick={copyPubkey} class="pt-1">
          <Icon size={3} icon={Copy} />
        </Button>
      </div>
    {/if}
  </div>
</div>
