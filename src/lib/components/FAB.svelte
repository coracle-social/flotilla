<script lang="ts">
  import type {ComponentProps, Snippet} from "svelte"
  import cx from "classnames"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"

  type Props = {
    onclick?: () => void
    menu?: ComponentProps<typeof MenuButton>["component"]
    menuProps?: ComponentProps<typeof MenuButton>["componentProps"]
    className?: string
    children?: Snippet
    "aria-label"?: string
  }

  const {
    onclick = () => {},
    menu,
    menuProps,
    className = "",
    children,
    "aria-label": ariaLabel,
  }: Props = $props()
</script>

{#snippet content()}
  <div class="flex items-center justify-center">
    {@render children?.()}
  </div>
{/snippet}

<div class={cx("absolute bottom-6 right-4 z-nav hide-on-keyboard md:hidden", className)}>
  {#if menu}
    <MenuButton
      component={menu}
      componentProps={menuProps}
      placement="top-end"
      aria-label={ariaLabel}
      class="button button-primary button-circle size-[50px]">
      {@render content()}
    </MenuButton>
  {:else}
    <Button
      class="button button-primary button-circle size-[50px]"
      aria-label={ariaLabel}
      {onclick}>
      {@render content()}
    </Button>
  {/if}
</div>
