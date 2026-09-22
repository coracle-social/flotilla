<script lang="ts">
  import type {Snippet} from "svelte"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    title: string
    icon: string
    action?: Snippet
    children: Snippet
    class?: string
  }

  const {title, icon, action, children, class: className = ""}: Props = $props()
</script>

<section
  class="flex min-w-0 flex-col overflow-hidden border-line bg-surface md:rounded-3xl md:border {className}">
  <div class="flex items-center justify-between gap-3 px-4 py-3">
    <h2 class="flex items-center gap-2 text-base font-bold">
      <Icon {icon} size={5} />
      {title}
    </h2>
    {@render action?.()}
  </div>
  {@render children()}
</section>
