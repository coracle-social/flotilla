<script lang="ts">
  import {remove} from "@welshman/lib"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayDescription from "@app/components/RelayDescription.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {roomLists, user} from "@app/core"
  import {userSpaceUrls} from "@app/rooms"

  type Props = {
    url: string
    hideFavorites?: boolean
  }

  const {url, hideFavorites}: Props = $props()
  const favorited = $roomLists.pubkeysForUrl(url).$
  const favoritedPubkeys = $derived(remove($user.pubkey, $favorited))
</script>

<div class="flex flex-col gap-4 text-left">
  <div class="flex flex-col gap-2">
    <div class="relative flex gap-2 sm:gap-4">
      <div class="relative">
        <div class="relative">
          <div
            class="flex justify-center items-center h-12 w-12 min-w-12 rounded-full border-2 border-solid bg-surface-more border-line">
            <RelayIcon {url} size={10} class="rounded-full" />
          </div>
        </div>
        {#if !hideFavorites && $userSpaceUrls.includes(url)}
          <div
            class="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-primary text-primary-content flex justify-center items-center">
            <Icon icon={CheckCircle} class="scale-120" />
          </div>
        {/if}
      </div>
      <div class="min-w-0">
        <RelayName {url} class="truncate whitespace-nowrap text-lg sm:text-xl" />
        <p class="text-xs sm:text-sm opacity-75">{url}</p>
      </div>
    </div>
    <div class="text-sm sm:text-md">
      <RelayDescription {url} />
    </div>
  </div>
  {#if !hideFavorites && favoritedPubkeys.length > 0}
    <div class="flex gap-2 card card-sm">
      Favorited By:
      <ProfileCircles pubkeys={favoritedPubkeys} />
    </div>
  {/if}
</div>
