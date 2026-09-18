<script lang="ts">
  import cx from "classnames"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Exit from "@assets/icons/logout-3.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceExit from "@app/components/SpaceExit.svelte"
  import SpaceEdit from "@app/components/SpaceEdit.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpaceActionItems from "@app/components/SpaceActionItems.svelte"
  import {relays, user} from "@app/core"
  import {deriveHostedRelay, HOSTING_ENABLED} from "@app/hosting"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {userSpaceUrls} from "@app/rooms"
  import {deriveSpaceActionItems} from "@app/actionItems"
  import {notificationSettings, deriveShouldNotify, setSpaceNotifications} from "@app/settings"
  import {pushModal, popModal} from "@app/modal"
  import {makeSpacePath, goToChat} from "@app/routes"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canReview = $derived(
    ["banevent", "allowpubkey"].some(method => $supportedMethods.includes(method)),
  )
  const canEditSpace = $derived(
    ["changerelayname", "changerelaydescription", "changerelayicon"].some(method =>
      $supportedMethods.includes(method),
    ),
  )
  const hostedRelay = deriveHostedRelay(url)
  const actionItems = deriveSpaceActionItems(url)
  const shouldNotify = deriveShouldNotify(url)

  const createInvite = () => pushModal(SpaceInvite, {url}, {replaceState: true})

  const startEdit = () =>
    pushModal(SpaceEdit, {url, initialValues: $relay || {url}}, {replaceState: true})

  const leaveSpace = () => pushModal(SpaceExit, {url}, {replaceState: true})

  const joinSpace = () => pushModal(SpaceJoin, {url}, {replaceState: true})

  const showActionItems = () => pushModal(SpaceActionItems, {url}, {replaceState: true})

  const contactOwner = () => goToChat([$relay!.pubkey!], {replaceState: true})

  const toggleSpaceNotifications = () => {
    popModal()
    setSpaceNotifications(url, !$shouldNotify)
  }
</script>

{#snippet actionButton(
  onclick: () => void,
  icon: string,
  label: string,
  variant?: "error" | "primary",
)}
  <Button
    class={cx("button w-full justify-start", {
      "button-neutral": !variant,
      "button-error": variant === "error",
      "button-primary": variant === "primary",
    })}
    {onclick}>
    <Icon size={4} {icon} />
    {label}
  </Button>
{/snippet}

{@render actionButton(createInvite, LinkRound, "Create Invite")}
{#if canReview}
  <Button class="button button-neutral w-full justify-start" onclick={showActionItems}>
    <Icon size={4} icon={Danger} />
    Action Items ({$actionItems.length})
    {#if $actionItems.length > 0}
      <div class="h-2 w-2 rounded-full bg-primary text-primary-content"></div>
    {/if}
  </Button>
{/if}
{#if $relay?.pubkey && $relay.pubkey !== $user.pubkey}
  {@render actionButton(contactOwner, Letter, "Contact Owner")}
{/if}
{#if $notificationSettings.push}
  {@render actionButton(
    toggleSpaceNotifications,
    $shouldNotify ? Bell : BellOff,
    `${$shouldNotify ? "Turn off" : "Turn on"} notifications`,
  )}
{:else}
  <Link href="/settings/alerts" class="button button-neutral w-full justify-start">
    <Icon size={4} icon={Bell} />
    Enable notifications
  </Link>
{/if}
{#if HOSTING_ENABLED && $hostedRelay.relay}
  <Link href={makeSpacePath(url, "admin")} class="button button-neutral w-full justify-start">
    <Icon size={4} icon={ServerPath} />
    Hosting settings
  </Link>
{:else if canEditSpace}
  {@render actionButton(startEdit, Pen, "Edit Space")}
{/if}
{#if $userSpaceUrls.includes(url)}
  {@render actionButton(leaveSpace, Exit, "Leave Space", "error")}
{:else}
  {@render actionButton(joinSpace, Login, "Join Space", "primary")}
{/if}
