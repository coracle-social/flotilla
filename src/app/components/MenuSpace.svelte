<script lang="ts">
  import {onMount} from "svelte"
  import {displayRelayUrl, getTagValue} from "@welshman/util"
  import {deriveRelay} from "@welshman/app"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceExit from "@app/components/SpaceExit.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import ProfileList from "@app/components/ProfileList.svelte"
  import AlertAdd from "@app/components/AlertAdd.svelte"
  import Alerts from "@app/components/Alerts.svelte"
  import RoomCreate from "@app/components/RoomCreate.svelte"
  import MenuSpaceRoomItem from "@app/components/MenuSpaceRoomItem.svelte"
  import {
    ENABLE_ZAPS,
    userRoomsByUrl,
    hasMembershipUrl,
    memberships,
    deriveUserRooms,
    deriveOtherRooms,
    hasNip29,
    alerts,
  } from "@app/state"
  import {notifications} from "@app/notifications"
  import {pushModal} from "@app/modal"
  import {makeSpacePath} from "@app/routes"

  const {url} = $props()

  const relay = deriveRelay(url)
  const chatPath = makeSpacePath(url, "chat")
  const goalsPath = makeSpacePath(url, "goals")
  const threadsPath = makeSpacePath(url, "threads")
  const calendarPath = makeSpacePath(url, "calendar")
  const userRooms = deriveUserRooms(url)
  const otherRooms = deriveOtherRooms(url)
  const hasAlerts = $derived($alerts.some(a => getTagValue("feed", a.tags)?.includes(url)))

  const openMenu = () => {
    showMenu = true
  }

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  const showMembers = () =>
    pushModal(
      ProfileList,
      {url, pubkeys: members, title: `Members of`, subtitle: displayRelayUrl(url)},
      {replaceState},
    )

  const createInvite = () => pushModal(SpaceInvite, {url}, {replaceState})

  const leaveSpace = () => pushModal(SpaceExit, {url}, {replaceState})

  const joinSpace = () => pushModal(SpaceJoin, {url}, {replaceState})

  const addRoom = () => pushModal(RoomCreate, {url}, {replaceState})

  const manageAlerts = () => {
    const component = hasAlerts ? Alerts : AlertAdd
    const params = {url, channel: "push", hideSpaceField: true}

    pushModal(component, params, {replaceState})
  }

  let showMenu = $state(false)
  let replaceState = $state(false)
  let element: Element | undefined = $state()

  const members = $derived(
    $memberships.filter(l => hasMembershipUrl(l, url)).map(l => l.event.pubkey),
  )

  onMount(() => {
    replaceState = Boolean(element?.closest(".drawer"))
  })
</script>

<div bind:this={element} class="flex h-full flex-col justify-between">
  <SecondaryNavSection>
    <div>
      <SecondaryNavItem class="w-full !justify-between" onclick={openMenu}>
        <strong class="ellipsize flex items-center gap-3">
          {displayRelayUrl(url)}
        </strong>
        <Icon icon="alt-arrow-down" />
      </SecondaryNavItem>
      {#if showMenu}
        <Popover hideOnClick onClose={toggleMenu}>
          <ul
            transition:fly
            class="menu absolute z-popover mt-2 w-full gap-1 rounded-box bg-base-100 p-2 shadow-xl">
            <li>
              <Button onclick={showMembers}>
                <Icon icon="user-rounded" />
                View Members ({members.length})
              </Button>
            </li>
            <li>
              <Button onclick={createInvite}>
                <Icon icon="link-round" />
                Create Invite
              </Button>
            </li>
            <li>
              {#if $userRoomsByUrl.has(url)}
                <Button onclick={leaveSpace} class="text-error">
                  <Icon icon="exit" />
                  Leave Space
                </Button>
              {:else}
                <Button onclick={joinSpace} class="bg-primary text-primary-content">
                  <Icon icon="login-2" />
                  Join Space
                </Button>
              {/if}
            </li>
          </ul>
        </Popover>
      {/if}
    </div>
    <div class="flex max-h-[calc(100vh-150px)] min-h-0 flex-col gap-1 overflow-auto">
      <SecondaryNavItem {replaceState} href={makeSpacePath(url)}>
        <Icon icon="home-smile" /> Home
      </SecondaryNavItem>
      {#if ENABLE_ZAPS}
        <SecondaryNavItem
          {replaceState}
          href={goalsPath}
          notification={$notifications.has(goalsPath)}>
          <Icon icon="star-fall-minimalistic-2" /> Goals
        </SecondaryNavItem>
      {/if}
      <SecondaryNavItem
        {replaceState}
        href={threadsPath}
        notification={$notifications.has(threadsPath)}>
        <Icon icon="notes-minimalistic" /> Threads
      </SecondaryNavItem>
      <SecondaryNavItem
        {replaceState}
        href={calendarPath}
        notification={$notifications.has(calendarPath)}>
        <Icon icon="calendar-minimalistic" /> Calendar
      </SecondaryNavItem>
      {#if hasNip29($relay)}
        {#if $userRooms.length > 0}
          <div class="h-2"></div>
          <SecondaryNavHeader>Your Rooms</SecondaryNavHeader>
        {/if}
        {#each $userRooms as room, i (room)}
          <MenuSpaceRoomItem {replaceState} notify {url} {room} />
        {/each}
        {#if $otherRooms.length > 0}
          <div class="h-2"></div>
          <SecondaryNavHeader>
            {#if $userRooms.length > 0}
              Other Rooms
            {:else}
              Rooms
            {/if}
          </SecondaryNavHeader>
        {/if}
        {#each $otherRooms as room, i (room)}
          <MenuSpaceRoomItem {replaceState} {url} {room} />
        {/each}
        <SecondaryNavItem {replaceState} onclick={addRoom}>
          <Icon icon="add-circle" />
          Create room
        </SecondaryNavItem>
      {:else}
        <SecondaryNavItem
          {replaceState}
          href={chatPath}
          notification={$notifications.has(chatPath)}>
          <Icon icon="chat-round" /> Chat
        </SecondaryNavItem>
      {/if}
    </div>
  </SecondaryNavSection>
  <div class="p-4">
    <button class="btn btn-neutral btn-sm w-full" onclick={manageAlerts}>
      <Icon icon="bell" />
      Manage Alerts
    </button>
  </div>
</div>
