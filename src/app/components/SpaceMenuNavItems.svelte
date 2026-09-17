<script lang="ts">
  import {page} from "$app/stores"
  import {getJson, setJson} from "@welshman/lib"
  import {EVENT_TIME, ZAP_GOAL, THREAD, CLASSIFIED, PINBOARD, POLL, LONG_FORM} from "@welshman/util"
  import {deriveDeduplicatedByValue} from "@welshman/store"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import Home from "@assets/icons/home.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic-2.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import Revote from "@assets/icons/revote.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SpaceSearch from "@app/components/SpaceSearch.svelte"
  import {relays} from "@app/core"
  import {ENABLE_ZAPS} from "@app/env"
  import {CONTENT_KINDS} from "@app/content"
  import {deriveEventsForUrl} from "@app/repository"
  import {makeSpacePath} from "@app/routes"
  import {allNotifications, notifications} from "@app/notifications"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
  const chatPath = makeSpacePath(url, "chat")
  const goalsPath = makeSpacePath(url, "goals")
  const threadsPath = makeSpacePath(url, "threads")
  const classifiedsPath = makeSpacePath(url, "classifieds")
  const articlesPath = makeSpacePath(url, "articles")
  const calendarPath = makeSpacePath(url, "calendar")
  const pollsPath = makeSpacePath(url, "polls")
  const libraryPath = makeSpacePath(url, "library")

  // Content events aren't retained across page loads, so seed with the kinds seen last time
  // to keep the nav from re-populating as they load in the background.
  const spaceKindsKey = `space-kinds:${url}`
  const cachedKinds: number[] = getJson(spaceKindsKey) ?? []

  const spaceKinds = deriveDeduplicatedByValue(
    deriveEventsForUrl(url, [{kinds: CONTENT_KINDS}]),
    $events => new Set([...cachedKinds, ...$events.map(e => e.kind)]),
  )

  // A section is also offered while something under it is unread, or while we're in it. A comment
  // can name content this space doesn't have, and it counts toward the space either way — hiding
  // the section it belongs to is what leaves a space lit up with nothing to read.
  const showSection = (kind: number, path: string) =>
    $spaceKinds.has(kind) || $allNotifications.has(path) || $page.url.pathname.startsWith(path)

  const hasNip29 = $derived($relay?.hasNip(29) ?? false)

  const openSearch = () => pushModal(SpaceSearch, {url})

  $effect(() => setJson(spaceKindsKey, [...$spaceKinds]))
</script>

<SecondaryNavItem href={makeSpacePath(url, "about")}>
  <Icon icon={Home} /> Space Details
</SecondaryNavItem>
{#if !hasNip29}
  <SecondaryNavItem href={chatPath} notification={$notifications.has(chatPath)}>
    <Icon icon={ChatRound} /> Chat
  </SecondaryNavItem>
{/if}
<SecondaryNavItem href={makeSpacePath(url, "directory")}>
  <Icon icon={UsersGroup} /> Directory
</SecondaryNavItem>
{#if showSection(PINBOARD, libraryPath)}
  <SecondaryNavItem href={libraryPath} notification={$notifications.has(libraryPath)}>
    <Icon icon={GalleryWide} /> Library
  </SecondaryNavItem>
{/if}
{#if ENABLE_ZAPS && showSection(ZAP_GOAL, goalsPath)}
  <SecondaryNavItem href={goalsPath} notification={$notifications.has(goalsPath)}>
    <Icon icon={StarFallMinimalistic} /> Goals
  </SecondaryNavItem>
{/if}
{#if showSection(THREAD, threadsPath)}
  <SecondaryNavItem href={threadsPath} notification={$notifications.has(threadsPath)}>
    <Icon icon={NotesMinimalistic} /> Threads
  </SecondaryNavItem>
{/if}
{#if showSection(LONG_FORM, articlesPath)}
  <SecondaryNavItem href={articlesPath} notification={$notifications.has(articlesPath)}>
    <Icon icon={DocumentText} /> Articles
  </SecondaryNavItem>
{/if}
{#if showSection(CLASSIFIED, classifiedsPath)}
  <SecondaryNavItem href={classifiedsPath} notification={$notifications.has(classifiedsPath)}>
    <Icon icon={CaseMinimalistic} /> Classifieds
  </SecondaryNavItem>
{/if}
{#if showSection(EVENT_TIME, calendarPath)}
  <SecondaryNavItem href={calendarPath} notification={$notifications.has(calendarPath)}>
    <Icon icon={CalendarMinimalistic} /> Calendar
  </SecondaryNavItem>
{/if}
{#if showSection(POLL, pollsPath)}
  <SecondaryNavItem href={pollsPath} notification={$notifications.has(pollsPath)}>
    <Icon icon={Revote} /> Polls
  </SecondaryNavItem>
{/if}
{#if hasNip29}
  <SecondaryNavItem onclick={openSearch}>
    <Icon icon={Magnifier} /> Search
  </SecondaryNavItem>
{/if}
