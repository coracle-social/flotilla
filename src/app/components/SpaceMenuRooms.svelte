<script lang="ts">
  import {derived} from "svelte/store"
  import {createSearch} from "@welshman/app"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SpaceMenuRoomItem from "@app/components/SpaceMenuRoomItem.svelte"
  import RoomCreate from "@app/components/RoomCreate.svelte"
  import {deriveUserCanCreateRoom} from "@app/management"
  import {deriveIsGroupSpace} from "@app/relays"
  import {RoomType, deriveUserRooms, deriveOtherRooms, displayRoom} from "@app/rooms"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    mobile?: boolean
  }

  const {url, mobile = false}: Props = $props()

  const isGroupSpace = deriveIsGroupSpace(url)
  const userRooms = deriveUserRooms(url)
  const otherRooms = deriveOtherRooms(url, RoomType.Text)
  const otherVoiceRooms = deriveOtherRooms(url, RoomType.Voice)
  const canCreateRoom = deriveUserCanCreateRoom(url)

  const roomSearch = derived(otherRooms, $otherRooms =>
    createSearch(
      $otherRooms.map(h => ({h, name: displayRoom(url, h)})),
      {
        getValue: item => item.h,
        fuseOptions: {keys: ["name"]},
      },
    ),
  )

  const addRoom = () => pushModal(RoomCreate, {url})

  const clearTerm = () => {
    setTimeout(() => {
      term = ""
    }, 100)
  }

  let term = $state("")
</script>

{#snippet content()}
  {#if $userRooms.length > 0}
    {#if !mobile}
      <div class="h-2 shrink-0"></div>
    {/if}
    <SecondaryNavHeader>Your Rooms</SecondaryNavHeader>
  {/if}
  {#each $userRooms as h (h)}
    <SpaceMenuRoomItem {url} {h} tooltip={!mobile} />
  {/each}
  {#if $otherRooms.length > 0}
    {#if !mobile}
      <div class="h-2 shrink-0"></div>
    {/if}
    <SecondaryNavHeader>
      {#if $userRooms.length > 0}
        Other Rooms
      {:else}
        Rooms
      {/if}
    </SecondaryNavHeader>
  {/if}
  {#if $otherRooms.length > 20}
    <label class="input input-sm flex items-center gap-2">
      <Icon icon={Magnifier} />
      <input bind:value={term} onblur={clearTerm} class="grow" />
    </label>
  {/if}
  {#each $roomSearch.searchValues(term) as h (h)}
    <SpaceMenuRoomItem {url} {h} tooltip={!mobile} />
  {/each}
  {#if $otherVoiceRooms.length > 0}
    {#if !mobile}
      <div class="h-2 shrink-0"></div>
    {/if}
    <SecondaryNavHeader>Voice Rooms</SecondaryNavHeader>
    {#each $otherVoiceRooms as h (h)}
      <SpaceMenuRoomItem {url} {h} tooltip={!mobile} />
    {/each}
  {/if}
  {#if $canCreateRoom}
    <SecondaryNavItem onclick={addRoom}>
      <Icon icon={AddCircle} />
      Create room
    </SecondaryNavItem>
  {/if}
{/snippet}

{#if $isGroupSpace && ($userRooms.length > 0 || $otherRooms.length > 0 || $otherVoiceRooms.length > 0 || $canCreateRoom)}
  {#if mobile}
    <div class="card space-menu__card flex flex-col gap-1">
      {@render content()}
    </div>
  {:else}
    {@render content()}
  {/if}
{/if}
