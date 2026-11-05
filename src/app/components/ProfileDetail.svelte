<script lang="ts">
  import {onMount} from "svelte"
  import {readable} from "svelte/store"
  import {spec} from "@welshman/lib"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import Tuning from "@assets/icons/tuning-2.svg?dataurl"
  import Letter from "@assets/icons/letter-opened.svg?dataurl"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileBadges from "@app/components/ProfileBadges.svelte"
  import ProfileFollowButton from "@app/components/ProfileFollowButton.svelte"
  import ProfileLocation from "@app/components/ProfileLocation.svelte"
  import ProfileMenu from "@app/components/ProfileMenu.svelte"
  import ProfilePinnedNote from "@app/components/ProfilePinnedNote.svelte"
  import ProfileStatus from "@app/components/ProfileStatus.svelte"
  import SpaceMemberManage from "@app/components/SpaceMemberManage.svelte"
  import {user} from "@app/core/user"
  import {messagingRelayLists, profiles, relayManagement} from "@app/core/plugins"
  import {deriveSpacePermissions, spaceManagement} from "@app/features/spaces/management"
  import type {BannedPubkeyItem} from "@app/features/spaces/management"
  import {deriveMemberModeration} from "@app/features/spaces/rooms"
  import {navigate} from "@app/navigation/navigate"
  import {popModal, pushModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/features/toast"
  import * as pages from "@app/navigation/pages"
  import {goToMessages} from "@app/features/messages"

  export type Props = {
    pubkey: string
    url?: string
    h?: string
  }

  const {pubkey, url, h}: Props = $props()

  const permissions = deriveSpacePermissions(url)
  const moderation = url ? deriveMemberModeration(url, h) : readable(undefined)
  const bans = url ? $spaceManagement.bannedPubkeys(url) : readable<BannedPubkeyItem[]>([])
  const isBanned = $derived($bans.some(spec({pubkey})))

  const isSelf = $derived($user.pubkey === pubkey)

  const back = () => history.back()

  const viewProfile = () => navigate(pages.profile.path({pubkey}))

  const sendMessage = () => {
    popModal()
    goToMessages([pubkey])
  }

  const loadBans = () => {
    if (url && $permissions.listBans) {
      $spaceManagement.loadBannedPubkeys(url)
    }
  }

  const report = (error: string | undefined, message: string) => {
    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message})
      loadBans()
      back()
    }
  }

  const manageMember = () => pushModal(SpaceMemberManage, {url: url!, pubkey, h}, {nested: true})

  const restoreMember = async () => {
    const {error} = await $relayManagement.forUrl(url!).allowPubkey(pubkey)

    report(error, "User has successfully been restored!")
  }

  $effect(loadBans)

  onMount(() => {
    $profiles.forceLoad(pubkey)
    $messagingRelayLists.load(pubkey)
  })
</script>

<Modal label="Profile details">
  <ModalBody>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between">
        <Profile showPubkey avatarSize={14} {pubkey} {url} />
        {#snippet customActions()}
          {#if !isSelf}
            <li>
              <Button onclick={sendMessage}>
                <Icon size={4} icon={Letter} />
                Send Message
              </Button>
            </li>
          {/if}
          {#if isBanned}
            {#if $permissions.addMembers}
              <li>
                <Button onclick={restoreMember}>
                  <Icon size={4} icon={Restart} />
                  Restore Membership
                </Button>
              </li>
            {/if}
          {:else if $moderation?.(pubkey).manage}
            <li>
              <Button onclick={manageMember}>
                <Icon size={4} icon={Tuning} />
                Manage member
              </Button>
            </li>
          {/if}
        {/snippet}
        <MenuButton
          aria-label="Profile actions"
          component={ProfileMenu}
          componentProps={{pubkey, url, customActions}} />
      </div>
      <ProfileStatus {pubkey} {url} />
      <ProfileLocation {pubkey} {url} />
      <ProfileAbout {pubkey} {url} />
      <ProfileBadges {pubkey} {url} />
      <ProfilePinnedNote {pubkey} {url} />
    </div>
  </ModalBody>
  <ModalFooter>
    <Button onclick={back} class="button button-link hidden md:flex">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <div class="flex gap-2">
      {#if !isSelf}
        <ProfileFollowButton {pubkey} />
      {/if}
      <Button onclick={viewProfile} class="button button-primary">
        <Icon icon={UserCircle} />
        View Full Profile
      </Button>
    </div>
  </ModalFooter>
</Modal>
