<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {removeUndefined} from "@welshman/lib"
  import {displayPubkey} from "@welshman/util"
  import {deriveHandleForPubkey, displayHandle, deriveProfileDisplay} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import WotScore from "@app/components/WotScore.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {pushModal} from "@app/util/modal"
  import {clip} from "@app/util/toast"
  import Copy from "@assets/icons/copy.svg?dataurl"

  type Props = {
    pubkey: string
    url?: string
    showPubkey?: boolean
    avatarSize?: number
  }

  const {pubkey, url, showPubkey, avatarSize = 10}: Props = $props()

  const relays = removeUndefined([url])
  const profileDisplay = deriveProfileDisplay(pubkey, relays)
  const handle = deriveHandleForPubkey(pubkey)

  const openProfile = () => pushModal(ProfileDetail, {pubkey, url})

  const copyPubkey = () => clip(nip19.npubEncode(pubkey))
</script>

<div class="flex max-w-full items-start gap-3">
  <Button onclick={openProfile} class="py-1">
    <ProfileCircle {pubkey} size={avatarSize} />
  </Button>
  <div class="flex min-w-0 flex-col">
    <div class="flex items-center gap-2">
      <Button onclick={openProfile} class="text-bold overflow-hidden text-ellipsis">
        {$profileDisplay}
      </Button>
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
