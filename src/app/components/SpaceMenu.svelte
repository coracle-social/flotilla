<script lang="ts">
  import {onMount} from "svelte"
  import {derived} from "svelte/store"
  import {displayRelayUrl, EVENT_TIME, ZAP_GOAL, THREAD, CLASSIFIED, REPORT} from "@welshman/util"
  import {deriveRelay, createSearch, pubkey} from "@welshman/app"
  import {fly} from "@lib/transition"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import RemoteControllerMinimalistic from "@assets/icons/remote-controller-minimalistic.svg?dataurl"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Exit from "@assets/icons/logout-3.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import History from "@assets/icons/history.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic-2.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import VolumeCross from "@assets/icons/volume-cross.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SpaceDetail from "@app/components/SpaceDetail.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceExit from "@app/components/SpaceExit.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import SpaceMembers from "@app/components/SpaceMembers.svelte"
  import SpaceReports from "@app/components/SpaceReports.svelte"
  import RoomCreate from "@app/components/RoomCreate.svelte"
  import SpaceMenuRoomItem from "@app/components/SpaceMenuRoomItem.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import {
    ENABLE_ZAPS,
    CONTENT_KINDS,
    deriveSpaceMembers,
    deriveUserRooms,
    deriveOtherRooms,
    userSpaceUrls,
    hasNip29,
    deriveUserCanCreateRoom,
    deriveUserIsSpaceAdmin,
    deriveEventsForUrl,
    notificationSettings,
    deriveShouldNotify,
    displayRoom,
  } from "@app/core/state"
  import {setSpaceNotifications} from "@app/core/commands"
  import {pushModal} from "@app/util/modal"
  import {makeSpacePath, makeChatPath} from "@app/util/routes"

  const {url} = $props()

  const relay = deriveRelay(url)
  const chatPath = makeSpacePath(url, "chat")
  const goalsPath = makeSpacePath(url, "goals")
  const threadsPath = makeSpacePath(url, "threads")
  const classifiedsPath = makeSpacePath(url, "classifieds")
  const calendarPath = makeSpacePath(url, "calendar")
  const userRooms = deriveUserRooms(url)
  const otherRooms = deriveOtherRooms(url)
  const members = deriveSpaceMembers(url)
  const userIsAdmin = deriveUserIsSpaceAdmin(url)
  const reports = deriveEventsForUrl(url, [{kinds: [REPORT]}])

  const spaceKinds = derived(
    deriveEventsForUrl(url, [{kinds: CONTENT_KINDS}]),
    $events => new Set($events.map(e => e.kind)),
  )

  const roomSearch = derived(otherRooms, $otherRooms =>
    createSearch(
      $otherRooms.map(h => ({h, name: displayRoom(url, h)})),
      {
        getValue: item => item.h,
        fuseOptions: {keys: ["name"]},
      },
    ),
  )

  const openMenu = () => {
    showMenu = true
  }

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  const showDetail = () => pushModal(SpaceDetail, {url}, {replaceState})

  const showMembers = () => pushModal(SpaceMembers, {url}, {replaceState})

  const showReports = () => pushModal(SpaceReports, {url}, {replaceState})

  const canCreateRoom = deriveUserCanCreateRoom(url)

  const createInvite = () => pushModal(SpaceInvite, {url}, {replaceState})

  const leaveSpace = () => pushModal(SpaceExit, {url}, {replaceState})

  const joinSpace = () => pushModal(SpaceJoin, {url}, {replaceState})

  const addRoom = () => pushModal(RoomCreate, {url}, {replaceState})

  const shouldNotify = deriveShouldNotify(url)

  const toggleSpaceNotifications = () => {
    setSpaceNotifications(url, !$shouldNotify)
  }

  const clearTerm = () => {
    setTimeout(() => {
      term = ""
    }, 100)
  }

  let term = $state("")
  let showMenu = $state(false)
  let replaceState = $state(false)
  let element: Element | undefined = $state()

  onMount(() => {
    replaceState = Boolean(element?.closest(".drawer"))
  })
</script>

<div bind:this={element} class="flex h-full flex-col justify-between">
  <SecondaryNavSection class="pb-0">
    <div>
      <Button
        class="flex w-full flex-col rounded-xl p-3 transition-all hover:bg-base-100"
        onclick={openMenu}>
        <div class="flex items-center justify-between">
          <strong class="ellipsize flex items-center gap-1">
            <RelayName {url} />
            {#if $notificationSettings.push && !$shouldNotify}
              <Icon icon={VolumeCross} size={3} class="opacity-50" />
            {/if}
          </strong>
          <Icon icon={AltArrowDown} />
        </div>
        <span class="text-xs text-primary">{displayRelayUrl(url)}</span>
      </Button>
      {#if showMenu}
        <Popover hideOnClick onClose={toggleMenu}>
          <ul
            transition:fly
            class="menu absolute z-popover mt-2 w-full gap-1 rounded-box bg-base-100 p-2 shadow-md">
            <li>
              <Button onclick={createInvite}>
                <Icon icon={LinkRound} />
                Create Invite
              </Button>
            </li>
            <li>
              <Button onclick={showDetail}>
                <Icon icon={RemoteControllerMinimalistic} />
                Space Information
              </Button>
            </li>
            <li>
              <Button onclick={showMembers}>
                <Icon icon={UserRounded} />
                View Members ({$members.length})
              </Button>
            </li>
            {#if $userIsAdmin}
              <li>
                <Button onclick={showReports}>
                  <Icon icon={Danger} />
                  View Reports ({$reports.length})
                </Button>
              </li>
            {/if}
            {#if $relay?.pubkey && $relay.pubkey !== $pubkey}
              <li>
                <Link href={makeChatPath([$relay.pubkey])}>
                  <Icon icon={Letter} />
                  Contact Owner
                </Link>
              </li>
            {/if}
            <li>
              {#if $notificationSettings.push}
                <Button onclick={toggleSpaceNotifications}>
                  <Icon icon={$shouldNotify ? VolumeLoud : VolumeCross} />
                  {$shouldNotify ? "Turn off" : "Turn on"} notifications
                </Button>
              {:else}
                <Link href="/settings/alerts">
                  <Icon icon={VolumeLoud} />
                  Enable notifications
                </Link>
              {/if}
            </li>
            <li>
              {#if $userSpaceUrls.includes(url)}
                <Button onclick={leaveSpace} class="text-error">
                  <Icon icon={Exit} />
                  Leave Space
                </Button>
              {:else}
                <Button onclick={joinSpace} class="bg-primary text-primary-content">
                  <Icon icon={Login} />
                  Join Space
                </Button>
              {/if}
            </li>
          </ul>
        </Popover>
      {/if}
    </div>
    <div
      class="flex max-h-[calc(100vh-150px)] min-h-0 flex-col gap-1 overflow-auto overflow-x-hidden">
      {#if hasNip29($relay)}
        <SecondaryNavItem {replaceState} href={makeSpacePath(url, "recent")}>
          <Icon icon={History} /> Recent Activity
        </SecondaryNavItem>
      {:else}
        <SecondaryNavItem {replaceState} href={chatPath}>
          <Icon icon={ChatRound} /> Chat
        </SecondaryNavItem>
      {/if}
      {#if ENABLE_ZAPS && $spaceKinds.has(ZAP_GOAL)}
        <SecondaryNavItem {replaceState} href={goalsPath}>
          <Icon icon={StarFallMinimalistic} /> Goals
        </SecondaryNavItem>
      {/if}
      {#if $spaceKinds.has(THREAD)}
        <SecondaryNavItem {replaceState} href={threadsPath}>
          <Icon icon={NotesMinimalistic} /> Threads
        </SecondaryNavItem>
      {/if}
      {#if $spaceKinds.has(CLASSIFIED)}
        <SecondaryNavItem {replaceState} href={classifiedsPath}>
          <Icon icon={CaseMinimalistic} /> Classifieds
        </SecondaryNavItem>
      {/if}
      {#if $spaceKinds.has(EVENT_TIME)}
        <SecondaryNavItem {replaceState} href={calendarPath}>
          <Icon icon={CalendarMinimalistic} /> Calendar
        </SecondaryNavItem>
      {/if}
      {#if hasNip29($relay)}
        {#if $userRooms.length > 0}
          <div class="h-2"></div>
          <SecondaryNavHeader>Your Rooms</SecondaryNavHeader>
        {/if}
        {#each $userRooms as h, i (h)}
          <SpaceMenuRoomItem {replaceState} {url} {h} />
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
        {#if $otherRooms.length > 20}
          <label class="input input-sm input-bordered flex items-center gap-2">
            <Icon icon={Magnifier} />
            <input bind:value={term} onblur={clearTerm} class="grow" />
          </label>
        {/if}
        {#each $roomSearch.searchValues(term) as h, i (h)}
          <SpaceMenuRoomItem {replaceState} {url} {h} />
        {/each}
        {#if $canCreateRoom}
          <SecondaryNavItem {replaceState} onclick={addRoom}>
            <Icon icon={AddCircle} />
            Create room
          </SecondaryNavItem>
        {/if}
      {/if}
    </div>
  </SecondaryNavSection>
  <div class="flex flex-col gap-2 pb-2 p-4 pt-0">
    <Button class="btn btn-neutral btn-sm h-10" onclick={showDetail}>
      <SocketStatusIndicator {url} />
    </Button>
  </div>
</div>
