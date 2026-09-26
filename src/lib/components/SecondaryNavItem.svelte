<script lang="ts">
  import type {Snippet} from "svelte"
  import type {HTMLAttributes} from "svelte/elements"
  import cx from "classnames"
  import {fade} from "@lib/transition"
  import {page} from "$app/stores"

  type Props = HTMLAttributes<HTMLElement> & {
    children?: Snippet
    href?: string
    title?: string
    notification?: boolean
  }

  const {children, href = "", title = "", notification = false, ...restProps}: Props = $props()

  const active = $derived($page.url.pathname === href)
  const wrapperClass = $derived(
    cx(
      restProps.class,
      "secondary-nav__nav-item relative flex shrink-0 items-center gap-3 text-left transition-all",
      {
        "secondary-nav__nav-item--active": active,
        "tip tip-right": title,
      },
    ),
  )
</script>

{#if href}
  <a {href} {...restProps} data-tip={title} class={wrapperClass}>
    {@render children?.()}
    {#if notification}
      <div class="secondary-nav__dot" transition:fade></div>
    {/if}
  </a>
{:else}
  <button {...restProps} data-tip={title} class={wrapperClass}>
    {#if notification}
      <div class="secondary-nav__dot" transition:fade></div>
    {/if}
    {@render children?.()}
  </button>
{/if}
