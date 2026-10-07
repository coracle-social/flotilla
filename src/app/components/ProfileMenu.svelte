<script lang="ts">
  import type {Snippet} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import {MuteLists, publish} from "@welshman/app"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import UserBlock from "@assets/icons/user-block.svg?dataurl"
  import UserCheck from "@assets/icons/user-check.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileInfo from "@app/components/ProfileInfo.svelte"
  import ProfileQrCode from "@app/components/ProfileQrCode.svelte"
  import {deriveUserItem, muteLists, profiles, user} from "@app/core"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    pubkey: string
    url?: string
    onClick: () => void
    customActions?: Snippet
  }

  const {pubkey, url, onClick, customActions}: Props = $props()

  const profile = $profiles.one(pubkey, removeUndefined([url]))

  const userMuteList = deriveUserItem(MuteLists)

  const isSelf = $derived($user.pubkey === pubkey)

  const isMuted = $derived(($userMuteList?.pubkeys() ?? []).includes(pubkey))

  const showInfo = () => pushModal(ProfileInfo, {event: $profile!.event, url})

  const showShare = () => pushModal(ProfileQrCode, {pubkey})

  const toggleMute = async () => {
    if (isMuted) {
      await $muteLists.unmute(pubkey).then(publish)

      pushToast({message: "You are no longer muting this person."})
    } else {
      await $muteLists.mutePublicly(["p", pubkey]).then(publish)

      pushToast({message: "You have muted this person."})
    }
  }
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={showShare}>
      <Icon size={4} icon={ShareCircle} />
      Share
    </Button>
  </li>
  {#if $profile}
    <li>
      <Button onclick={showInfo}>
        <Icon size={4} icon={Code2} />
        Profile Info
      </Button>
    </li>
  {/if}
  {#if !isSelf}
    <li>
      <Button onclick={toggleMute}>
        <Icon size={4} icon={isMuted ? UserCheck : UserBlock} />
        {isMuted ? "Unmute User" : "Mute User"}
      </Button>
    </li>
  {/if}
  {@render customActions?.()}
</ul>
