<script lang="ts">
  import {Client} from "@pomade/core"
  import type {SessionItem} from "@pomade/core"
  import {session, isPomadeSession} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import {pushToast} from "@app/util/toast"
  import {onMount} from "svelte"

  type SessionWithPeers = SessionItem & {peers: string[]}

  let sessions = $state<SessionWithPeers[]>([])
  let deletingSession = $state<string | null>(null)

  const loadSessions = async () => {
    if (!isPomadeSession($session)) return

    try {
      const client = new Client($session.clientOptions)
      const result = await client.listSessions()
      const pubkey = await client.getPubkey()

      if (result.ok) {
        // Group sessions by client pubkey and collect peers
        const sessionMap = new Map<string, SessionWithPeers>()

        for (const message of result.messages) {
          if (!message?.payload.items) continue

          const peer = message.event.pubkey

          for (const item of message.payload.items) {
            const existing = sessionMap.get(item.client)

            if (existing) {
              existing.peers.push(peer)
            } else if (item.client !== pubkey) {
              sessionMap.set(item.client, {...item, peers: [peer]})
            }
          }
        }

        sessions = Array.from(sessionMap.values())
      } else {
        pushToast({
          theme: "error",
          message: "Failed to load sessions",
        })
      }

      client.stop()
    } catch (e) {
      console.error(e)
      pushToast({
        theme: "error",
        message: "Failed to load sessions",
      })
    }
  }

  const deleteSession = async (sessionItem: SessionWithPeers) => {
    if (!isPomadeSession($session)) return

    deletingSession = sessionItem.client

    try {
      const client = new Client($session.clientOptions)
      const result = await client.deleteSession(sessionItem.client, sessionItem.peers)

      if (result.ok) {
        pushToast({
          message: "Session deleted successfully",
        })

        // Remove from local list
        sessions = sessions.filter(s => s.client !== sessionItem.client)
      } else {
        pushToast({
          theme: "error",
          message: "Failed to delete session",
        })
      }

      client.stop()
    } catch (e) {
      console.error(e)
      pushToast({
        theme: "error",
        message: "Failed to delete session",
      })
    } finally {
      deletingSession = null
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  onMount(() => {
    loadSessions()
  })
</script>

{#if sessions.length > 0}
  <div class="flex flex-col gap-4 border-t border-solid border-base-100 pt-4">
    <strong>Other Sessions</strong>
    {#each sessions as sessionItem (sessionItem.client)}
      <div class="flex justify-between text-sm">
        <div class="flex flex-col gap-1">
          <span>{sessionItem.client.slice(0, 8)}</span>
          <div class="flex gap-1">
            <div class="badge badge-neutral">
              Created {formatDate(sessionItem.created_at)}
            </div>
            <div class="badge badge-neutral">
              Last active: {formatDate(sessionItem.last_activity)}
            </div>
          </div>
        </div>
        <Button
          class="btn btn-error btn-sm"
          disabled={deletingSession !== null}
          onclick={() => deleteSession(sessionItem)}>
          {#if deletingSession === sessionItem.client}
            <span class="loading loading-spinner"></span>
          {:else}
            <Icon icon={TrashBin2} />
          {/if}
        </Button>
      </div>
    {/each}
  </div>
{/if}
