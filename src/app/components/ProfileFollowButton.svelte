<script lang="ts">
  import {publish} from "@welshman/app"
  import UserPlus from "@assets/icons/user-plus.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {user} from "@app/core/user"
  import {followLists} from "@app/core/plugins"
  import {pushToast} from "@app/features/toast"

  type Props = {
    pubkey: string
    class?: string
  }

  const {pubkey, class: className = "button button-neutral"}: Props = $props()

  const follows = $derived($followLists.one($user.pubkey))
  const isFollowing = $derived(($follows?.pubkeys() ?? []).includes(pubkey))

  let loading = $state(false)

  const toggleFollow = async () => {
    loading = true

    try {
      if (isFollowing) {
        await $followLists.unfollow(pubkey).then(publish)
      } else {
        await $followLists.follow(["p", pubkey]).then(publish)
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update your follows."})
    } finally {
      loading = false
    }
  }
</script>

<Button class={className} disabled={loading} onclick={toggleFollow}>
  {#if loading}
    <Spinner size="xs" />
  {:else}
    <Icon icon={UserPlus} size={4} />
  {/if}
  {isFollowing ? "Unfollow" : "Follow"}
</Button>
