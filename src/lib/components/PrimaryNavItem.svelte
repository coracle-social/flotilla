<script lang="ts">
  import cx from "classnames"
  import {page} from "$app/stores"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"

  const {
    children,
    onclick = undefined,
    title = "",
    href = "",
    prefix = "",
    notification = false,
    ...restProps
  } = $props()

  const active = $derived($page.url?.pathname?.startsWith(prefix || href || "bogus"))

  const className = $derived(
    cx(restProps.class, "primary-nav__nav-item", {
      "primary-nav__nav-item--active": active,
      "tip tip-right": title,
    }),
  )
</script>

{#if onclick}
  <Button {onclick} data-tip={title} class={className}>
    {@render children?.()}
    {#if !active && notification}
      <div class="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary text-primary-content">
      </div>
    {/if}
  </Button>
{:else}
  <Link {href} data-tip={title} class={className}>
    {@render children?.()}
    {#if !active && notification}
      <div class="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary text-primary-content">
      </div>
    {/if}
  </Link>
{/if}
