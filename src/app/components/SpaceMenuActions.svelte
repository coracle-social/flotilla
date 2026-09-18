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

  const createInvite = () => pushModal(SpaceInvite, {url})

  const startEdit = () => pushModal(SpaceEdit, {url, initialValues: $relay || {url}})

  const leaveSpace = () => pushModal(SpaceExit, {url})

  const joinSpace = () => pushModal(SpaceJoin, {url})

  const showActionItems = () => pushModal(SpaceActionItems, {url})

  const contactOwner = () => goToChat([$relay!.pubkey!])

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
  <li>
    <Button
      {onclick}
      class={cx({
        "text-error": variant === "error",
        "bg-primary text-primary-content": variant === "primary",
      })}
      style={variant === "primary" ? "color: var(--primary-content)" : undefined}>
      <Icon {icon} />
      {label}
    </Button>
  </li>
{/snippet}

{@render actionButton(createInvite, LinkRound, "Create Invite")}
{#if canReview}
  <li>
    <Button onclick={showActionItems}>
      <Icon icon={Danger} />
      Action Items ({$actionItems.length})
      {#if $actionItems.length > 0}
        <div class="h-2 w-2 rounded-full bg-primary text-primary-content"></div>
      {/if}
    </Button>
  </li>
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
  <li>
    <Link href="/settings/alerts">
      <Icon icon={Bell} />
      Enable notifications
    </Link>
  </li>
{/if}
{#if HOSTING_ENABLED && $hostedRelay.relay}
  <li>
    <Link href={makeSpacePath(url, "admin")}>
      <Icon icon={ServerPath} />
      Hosting settings
    </Link>
  </li>
{:else if canEditSpace}
  {@render actionButton(startEdit, Pen, "Edit Space")}
{/if}
{#if $userSpaceUrls.includes(url)}
  {@render actionButton(leaveSpace, Exit, "Leave Space", "error")}
{:else}
  {@render actionButton(joinSpace, Login, "Join Space", "primary")}
{/if}
