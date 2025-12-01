<script lang="ts">
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayDescription from "@app/components/RelayDescription.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {deriveGroupListPubkeys, deriveUserRooms} from "@app/core/state"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
  const rooms = deriveUserRooms(url)
  const favorited = deriveGroupListPubkeys(url)
</script>

<div class="col-4 text-left">
  <div class="col-2">
    <div class="relative flex gap-4">
      <div class="relative">
        <div class="avatar relative">
          <div
            class="center !flex h-12 w-12 min-w-12 rounded-full border-2 border-solid border-base-300 bg-base-300">
            <RelayIcon {url} />
          </div>
        </div>
        {#if $rooms.includes(url)}
          <div
            class="tooltip absolute -right-1 -top-1 h-5 w-5 rounded-full bg-primary"
            data-tip="You are already a member of this space.">
            <Icon icon={CheckCircle} class="scale-110" />
          </div>
        {/if}
      </div>
      <div>
        <h2 class="ellipsize whitespace-nowrap text-xl">
          <RelayName {url} />
        </h2>
        <p class="text-sm opacity-75">{url}</p>
      </div>
    </div>
    <RelayDescription {url} />
  </div>
  {#if $favorited.size > 0}
    <div class="row-2 card2 card2-sm bg-alt">
      Favorited By:
      <ProfileCircles pubkeys={Array.from($favorited)} />
    </div>
  {/if}
</div>
