<script lang="ts">
  import {publish} from "@welshman/app"
  import UserPlus from "@assets/icons/user-plus.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {user} from "@app/core/user"
  import {followLists} from "@app/core/plugins"
  import {pushToast} from "@app/navigation/toast"
  import {withLogin} from "@app/components/flows/login"

  type Props = {
    pubkey: string
    class?: string
  }

  const {pubkey, class: className = "button button-neutral"}: Props = $props()

  const follows = $derived($followLists.one($user?.pubkey))
  const isFollowing = $derived(Boolean($follows?.includes(pubkey)))

  let wanted = $state<boolean>()

  const loading = $derived(wanted !== undefined)

  const toggleFollow = () => {
    const following = !isFollowing

    withLogin("follow this person", async () => {
      wanted = following

      try {
        const command = wanted
          ? await $followLists.follow(["p", pubkey])
          : await $followLists.unfollow(pubkey)
        const publication = publish(command)

        // `publish` returns before the repository holds the new list, which is what the label reads.
        await publication.written()

        publication.settled().then(({state}) => {
          if (state.stage === "failed") {
            pushToast({theme: "error", message: "Failed to update your follows."})
          }
        })
      } catch (e) {
        console.error(e)
        pushToast({theme: "error", message: "Failed to update your follows."})
      } finally {
        wanted = undefined
      }
    })
  }
</script>

<Button class={className} disabled={loading} onclick={toggleFollow}>
  {#if loading}
    <Spinner size="xs" />
  {:else}
    <Icon icon={UserPlus} size={4} />
  {/if}
  {(wanted ?? isFollowing) ? "Unfollow" : "Follow"}
</Button>
