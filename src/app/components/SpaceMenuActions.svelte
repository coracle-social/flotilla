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
  import {deriveSpacePermissions} from "@app/management"
  import {userSpaceUrls} from "@app/rooms"
  import {deriveSpaceActionItems} from "@app/actionItems"
  import {deriveShouldNotify, setSpaceNotifications} from "@app/settings"
  import {notificationSettings} from "@app/push"
  import {pushModal, popModal} from "@app/modal"
  import {makeSpacePath, goToChat} from "@app/routes"

  type Props = {
    url: string
    sheet?: boolean
  }

  const {url, sheet = false}: Props = $props()

  const relay = $relays.one(url)
  const permissions = deriveSpacePermissions(url)
  const hostedRelay = deriveHostedRelay(url)
  const actionItems = deriveSpaceActionItems(url)
  const shouldNotify = deriveShouldNotify(url)

  const createInvite = () => pushModal(SpaceInvite, {url}, {replaceState: sheet})

  const startEdit = () => pushModal(SpaceEdit, {url}, {replaceState: sheet})

  const leaveSpace = () => pushModal(SpaceExit, {url}, {replaceState: sheet})

  const joinSpace = () => pushModal(SpaceJoin, {url}, {replaceState: sheet})

  const showActionItems = () => pushModal(SpaceActionItems, {url}, {replaceState: sheet})

  const contactOwner = () => goToChat([$relay!.pubkey!], {replaceState: sheet})

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
  dot?: boolean,
)}
  {#if sheet}
    <Button
      class={cx("button w-full justify-start", {
        "button-neutral": !variant,
        "button-error": variant === "error",
        "button-primary": variant === "primary",
      })}
      {onclick}>
      <Icon size={4} {icon} />
      {label}
      {#if dot}
        <div class="h-2 w-2 rounded-full bg-primary text-primary-content"></div>
      {/if}
    </Button>
  {:else}
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
        {#if dot}
          <div class="h-2 w-2 rounded-full bg-primary text-primary-content"></div>
        {/if}
      </Button>
    </li>
  {/if}
{/snippet}

{#snippet actionLink(href: string, icon: string, label: string)}
  {#if sheet}
    <Link {href} class="button button-neutral w-full justify-start">
      <Icon size={4} {icon} />
      {label}
    </Link>
  {:else}
    <li>
      <Link {href}>
        <Icon {icon} />
        {label}
      </Link>
    </li>
  {/if}
{/snippet}

{@render actionButton(createInvite, LinkRound, "Create Invite")}
{#if $permissions.review}
  {@render actionButton(
    showActionItems,
    Danger,
    `Action Items (${$actionItems.length})`,
    undefined,
    $actionItems.length > 0,
  )}
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
  {@render actionLink("/settings/alerts", Bell, "Enable notifications")}
{/if}
{#if HOSTING_ENABLED && $hostedRelay.relay}
  {@render actionLink(makeSpacePath(url, "admin"), ServerPath, "Hosting settings")}
{:else if $permissions.editSpace}
  {@render actionButton(startEdit, Pen, "Edit Space")}
{/if}
{#if $userSpaceUrls.includes(url)}
  {@render actionButton(leaveSpace, Exit, "Leave Space", "error")}
{:else}
  {@render actionButton(joinSpace, Login, "Join Space", "primary")}
{/if}
