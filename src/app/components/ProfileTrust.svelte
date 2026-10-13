<script lang="ts">
  import {clamp} from "@welshman/lib"
  import {WotScope} from "@welshman/app"
  import Shield from "@assets/icons/shield-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {user} from "@app/core/app"
  import {followLists, profiles, wot} from "@app/core/plugins"

  type Props = {
    pubkey: string
    isSelf?: boolean
  }

  const {pubkey: target, isSelf = false}: Props = $props()

  const profileDisplay = $profiles.display(target).$
  const followers = $wot.followers(target, WotScope.Follows).$
  const score = $wot.score(target, WotScope.Follows).$
  const display = $derived(isSelf ? $followers.length : clamp([0, 100], $score))

  const trustMessage = $derived.by(() => {
    if ($followers.length > 0) {
      return `Followed by ${$followers.length}+ people in your network.`
    }

    return isSelf
      ? "No followers in your network yet."
      : "This user is not well known in your network."
  })

  $effect(() => {
    if (!isSelf) {
      $followLists.load(target)
      $followLists.load($user.pubkey)
    }
  })
</script>

<div class="card card-sm flex flex-col gap-3 sm:gap-4">
  <div class="flex items-center gap-2">
    <Icon icon={Shield} size={5} />
    <strong>Reputation</strong>
  </div>
  <div class="flex flex-col gap-2 border-t border-line pt-4">
    <div class="flex items-end justify-between gap-2">
      <span class="text-sm opacity-75">{isSelf ? "Followers" : "Trust score"}</span>
      <span class="text-lg font-semibold">
        {#if isSelf}
          {display}
        {:else}
          {display} / 100
        {/if}
      </span>
    </div>
    {#if !isSelf}
      <progress class="progress w-full" value={display} max="100"></progress>
    {/if}
    <p class="text-sm opacity-75">{trustMessage}</p>
  </div>
  {#if !isSelf && $followers.length > 0}
    <div class="flex flex-col gap-2 border-t border-line pt-4">
      <p class="text-sm font-medium">People who follow {$profileDisplay}</p>
      <ProfileCircles pubkeys={$followers} limit={5} />
      <p class="text-sm opacity-75">
        {$followers.length}
        {$followers.length === 1 ? "person" : "people"} you follow also
        {$followers.length === 1 ? "follows" : "follow"}
        {$profileDisplay}.
      </p>
    </div>
  {/if}
</div>
