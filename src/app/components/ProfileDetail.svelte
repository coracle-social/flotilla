<script lang="ts">
  import {onMount} from "svelte"
  import {removeUndefined, spec} from "@welshman/lib"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import UserMinus from "@assets/icons/user-minus.svg?dataurl"
  import Letter from "@assets/icons/letter-opened.svg?dataurl"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileBadges from "@app/components/ProfileBadges.svelte"
  import ProfileMenu from "@app/components/ProfileMenu.svelte"
  import ProfilePinnedNote from "@app/components/ProfilePinnedNote.svelte"
  import ProfileStatus from "@app/components/ProfileStatus.svelte"
  import {messagingRelayLists, profiles, relayManagement, user} from "@app/core"
  import {deriveUserIsSpaceAdmin} from "@app/management"
  import {navigate, popModal, pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {goToChat, makeProfilePath} from "@app/routes"

  export type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const isSelf = $derived($user.pubkey === pubkey)

  const back = () => history.back()

  const viewProfile = () => navigate(makeProfilePath(pubkey), {replaceState: true})

  const sendMessage = () => {
    popModal()
    goToChat([pubkey])
  }

  const report = (error: string | undefined, message: string) => {
    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message})
      back()
    }
  }

  const banMember = () =>
    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${$profiles.display(pubkey, removeUndefined([url])).get()} from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url!).banPubkey(pubkey)

        report(error, "User has successfully been banned!")
      },
    })

  const removeMember = async () => {
    const {error} = await $relayManagement.forUrl(url!).unallowPubkey(pubkey)

    report(error, "User has successfully been removed!")
  }

  const restoreMember = async () => {
    const {error} = await $relayManagement.forUrl(url!).allowPubkey(pubkey)

    report(error, "User has successfully been restored!")
  }

  let isBanned = $state(false)

  $effect(() => {
    if (url && $userIsAdmin) {
      $relayManagement
        .forUrl(url)
        .listBannedPubkeys()
        .then(({result = []}) => {
          isBanned = result.some(spec({pubkey}))
        })
    }
  })

  onMount(() => {
    $messagingRelayLists.load(pubkey)
  })
</script>

<Modal>
  <ModalBody>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between">
        <Profile showPubkey avatarSize={14} {pubkey} {url} />
        <ProfileMenu {pubkey} {url}>
          {#snippet customActions()}
            {#if !isSelf}
              <li>
                <Button onclick={sendMessage}>
                  <Icon size={4} icon={Letter} />
                  Send Message
                </Button>
              </li>
            {/if}
            {#if $userIsAdmin}
              {#if isBanned}
                <li>
                  <Button onclick={restoreMember}>
                    <Icon size={4} icon={Restart} />
                    Restore Membership
                  </Button>
                </li>
              {:else}
                <li>
                  <Button onclick={removeMember}>
                    <Icon size={4} icon={UserMinus} />
                    Remove Member
                  </Button>
                </li>
                <li>
                  <Button class="text-error" onclick={banMember}>
                    <Icon size={4} icon={MinusCircle} />
                    Ban User
                  </Button>
                </li>
              {/if}
            {/if}
          {/snippet}
        </ProfileMenu>
      </div>
      <ProfileStatus {pubkey} {url} />
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
      <Button onclick={viewProfile} class="button button-primary">
        <Icon icon={UserCircle} />
        View Full Profile
      </Button>
    </div>
  </ModalFooter>
</Modal>
