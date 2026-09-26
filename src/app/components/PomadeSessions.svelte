<script lang="ts">
  import {onMount} from "svelte"
  import {secondsToDate} from "@welshman/lib"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import PomadeSessionMenu from "@app/components/PomadeSessionMenu.svelte"
  import {pushToast} from "@app/toast"
  import {deletePomadeSession, loadOtherPomadeSessions} from "@app/pomade"
  import type {PomadeSessionWithPeers} from "@app/pomade"

  let sessions = $state<PomadeSessionWithPeers[]>([])

  const deleteSession = async (sessionItem: PomadeSessionWithPeers) => {
    try {
      await deletePomadeSession(sessionItem.client, sessionItem.peers)

      pushToast({message: "Session deleted successfully"})

      sessions = sessions.filter(s => s.client !== sessionItem.client)
    } catch (e) {
      console.error(e)
      pushToast({
        theme: "error",
        message: "Failed to delete session",
      })
    }
  }

  const formatDate = (timestamp: number) =>
    secondsToDate(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  onMount(() => {
    loadOtherPomadeSessions().then(_sessions => {
      sessions = _sessions || []
    })
  })
</script>

{#if sessions.length > 0}
  <div class="flex flex-col gap-4 border-t border-solid pt-4 border-line">
    <strong>Other Sessions</strong>
    {#each sessions as sessionItem (sessionItem.client)}
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <div class="flex gap-3 items-center text-sm">
            <span>Session {sessionItem.client.slice(0, 8)}</span>
            <span class="opacity-75">
              {#if sessionItem.deactivated_at}
                Deactivated
              {/if}
            </span>
          </div>
          <MenuButton
            component={PomadeSessionMenu}
            componentProps={{onDelete: () => deleteSession(sessionItem)}} />
        </div>
        <div class="flex gap-1">
          <span class="badge badge-neutral">
            Created {formatDate(sessionItem.created_at)}
          </span>
          <span class="badge badge-neutral">
            Active {formatDate(sessionItem.last_activity)}
          </span>
        </div>
      </div>
    {/each}
  </div>
{/if}
