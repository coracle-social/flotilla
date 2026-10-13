<script lang="ts">
  import {formatTimestampRelative} from "@welshman/lib"
  import History from "@assets/icons/history.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import type {Activity} from "@app/features/hosting"

  type Props = {
    activity: Activity[]
    loading?: boolean
  }

  const {activity, loading = false}: Props = $props()
</script>

<div class="card card-sm flex flex-col gap-4">
  <div class="flex items-center gap-2">
    <Icon icon={History} size={5} />
    <strong>Activity</strong>
  </div>
  {#if loading}
    <p class="text-sm opacity-75">Loading activity...</p>
  {:else if activity.length === 0}
    <p class="text-sm opacity-75">No activity yet.</p>
  {:else}
    <ol class="flex flex-col gap-4">
      {#each activity as item (item.id)}
        <li class="flex items-start gap-3">
          <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-content-muted"></span>
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {#if item.activity_type === "create_relay"}
                Relay created
              {:else if item.activity_type === "update_relay"}
                Relay updated
              {:else if item.activity_type === "deactivate_relay"}
                Relay deactivated
              {:else if item.activity_type === "activate_relay"}
                Relay activated
              {:else if item.activity_type === "fail_relay_sync"}
                Relay sync failed
              {:else if item.activity_type === "complete_relay_sync"}
                Relay sync completed
              {:else if item.activity_type === "create_tenant"}
                Account created
              {:else if item.activity_type === "update_tenant"}
                Account updated
              {:else}
                {item.activity_type.replace(/_/g, " ")}
              {/if}
            </p>
            <time class="text-xs opacity-75">{formatTimestampRelative(item.created_at)}</time>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>
