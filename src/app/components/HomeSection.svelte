<script lang="ts">
  import type {Snippet} from "svelte"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    title: string
    icon: string
    action?: Snippet
    children: Snippet
  }

  const {title, icon, action, children}: Props = $props()
</script>

<section class="flex min-w-0 flex-col border-b border-line last:border-b-0">
  <div class="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
    <h2 class="flex items-center gap-2 text-xs font-bold tracking-widest uppercase opacity-75">
      <Icon {icon} size={4} />
      {title}
    </h2>
    {@render action?.()}
  </div>
  {@render children()}
</section>
