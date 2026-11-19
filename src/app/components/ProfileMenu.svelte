<script lang="ts">
  import type {Snippet} from "svelte"
  import {publish} from "@welshman/app"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import UserBlock from "@assets/icons/user-block.svg?dataurl"
  import UserCheck from "@assets/icons/user-check.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfileInfo from "@app/components/ProfileInfo.svelte"
  import ProfileQrCode from "@app/components/ProfileQrCode.svelte"
  import {user} from "@app/core/user"
  import {muteLists, profiles} from "@app/core/plugins"
  import {HIDE_NOSTR} from "@app/core/env"
  import {derivePubkeyMuted} from "@app/tools/people/muting"
  import {pushModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"

  type Props = {
    pubkey: string
    url?: string
    onClick: () => void
    customActions?: Snippet
  }

  const {pubkey, url, onClick, customActions}: Props = $props()

  const profile = $profiles.one(pubkey)

  const isSelf = $derived($user?.pubkey === pubkey)

  const isMuted = derivePubkeyMuted(pubkey)

  const showInfo = () => pushModal(ProfileInfo, {event: $profile!.event, url})

  const showShare = () => pushModal(ProfileQrCode, {pubkey})

  const toggleMute = async () => {
    loading = true

    try {
      if ($isMuted) {
        await $muteLists.unmute(pubkey).then(publish)
        pushToast({message: "You are no longer muting this person."})
      } else {
        await $muteLists.mutePublicly(["p", pubkey]).then(publish)
        pushToast({message: "You have muted this person."})
      }
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: "Failed to update your mutes."})
    } finally {
      loading = false
      onClick()
    }
  }

  // The menu closes on any click in it, except on an item that closes it once its work is done.
  const onClickCapture = (event: MouseEvent) => {
    const holdsOpen = event.target instanceof Element && event.target.closest(".menu-holds-open")

    if (!holdsOpen) {
      onClick()
    }
  }

  let loading = $state(false)
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClickCapture}>
  <li>
    <Button onclick={showShare}>
      <Icon size={4} icon={ShareCircle} />
      Share
    </Button>
  </li>
  {#if $profile && !HIDE_NOSTR}
    <li>
      <Button onclick={showInfo}>
        <Icon size={4} icon={Code2} />
        Profile Info
      </Button>
    </li>
  {/if}
  {#if !isSelf}
    <li class="menu-holds-open">
      <Button onclick={toggleMute} disabled={loading}>
        {#if loading}
          <Spinner size="xs" />
        {:else}
          <Icon size={4} icon={$isMuted ? UserCheck : UserBlock} />
        {/if}
        {$isMuted ? "Unmute User" : "Mute User"}
      </Button>
    </li>
  {/if}
  {@render customActions?.()}
</ul>
