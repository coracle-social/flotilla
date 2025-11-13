<script lang="ts">
  import {goto} from "$app/navigation"
  import {shouldUnwrap} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Letter from "@assets/icons/letter-opened.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileInfo from "@app/components/ProfileInfo.svelte"
  import ProfileBadges from "@app/components/ProfileBadges.svelte"
  import ChatEnable from "@app/components/ChatEnable.svelte"
  import {pubkeyLink} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {makeChatPath} from "@app/util/routes"

  export type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const back = () => history.back()

  const chatPath = makeChatPath([pubkey])

  const openChat = () => ($shouldUnwrap ? goto(chatPath) : pushModal(ChatEnable, {next: chatPath}))
</script>

<div class="flex flex-col gap-4">
  <Profile showPubkey avatarSize={14} {pubkey} {url} />
  <ProfileInfo {pubkey} {url} />
  <ProfileBadges {pubkey} {url} />
  <ModalFooter>
    <Button onclick={back} class="hidden md:btn md:btn-link">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <div class="flex gap-2">
      <Link external href={pubkeyLink(pubkey)} class="btn btn-neutral">
        <ImageIcon alt="" src="/coracle.png" />
        Open in Coracle
      </Link>
      <Button onclick={openChat} class="btn btn-primary">
        <Icon icon={Letter} />
        Open Chat
      </Button>
    </div>
  </ModalFooter>
</div>
