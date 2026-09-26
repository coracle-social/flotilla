<script lang="ts">
  import type {RelayRoleReader} from "@welshman/domain"
  import RoleBadge from "@app/components/RoleBadge.svelte"

  type Props = {
    role: RelayRoleReader
  }

  const {role}: Props = $props()
</script>

<div class="flex min-w-0 flex-col gap-2 justify-between">
  <RoleBadge {role} size="md" />
  {#if role.description()}
    <p class="text-sm opacity-70">{role.description()}</p>
  {/if}
</div>
