<script lang="ts">
  import type {Snippet} from "svelte"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    title: string
    icon?: string
    nav?: Snippet
    action?: Snippet
    children: Snippet
    class?: string
  }

  const {title, icon, nav, action, children, class: className = ""}: Props = $props()
</script>

<section
  aria-label={title}
  class="flex min-w-0 flex-col overflow-hidden border-line bg-surface md:rounded-3xl md:border {className}">
  <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
    {#if nav}
      {@render nav()}
    {:else}
      <h2 class="flex shrink-0 items-center gap-2 text-base font-bold">
        {#if icon}
          <Icon {icon} size={5} />
        {/if}
        {title}
      </h2>
    {/if}
    {@render action?.()}
  </div>
  {@render children()}
</section>
