<script lang="ts">
  import type {Component, Snippet} from "svelte"
  import type {Placement} from "tippy.js"
  import type {Maybe} from "@welshman/lib"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    component: Component<any>
    componentProps?: Record<string, any>
    placement?: Placement
    strayMargin?: number
    class?: string
    iconSize?: number
    disabled?: boolean
    children?: Snippet
    "aria-label"?: string
  }

  const {
    component,
    componentProps = {},
    placement = "bottom-end",
    strayMargin,
    class: className = "button button-ghost button-sm button-circle",
    iconSize,
    disabled,
    children,
    "aria-label": ariaLabel,
  }: Props = $props()

  const showPopover = () => tippy?.show()

  const hidePopover = () => tippy?.hide()

  let tippy: Maybe<TippyController> = $state()
</script>

<Button class={className} aria-label={ariaLabel} {disabled} onclick={showPopover}>
  <Tippy
    bind:controller={tippy}
    {component}
    {strayMargin}
    props={{...componentProps, onClick: hidePopover}}
    params={{trigger: "manual", interactive: true, placement}}>
    {#if children}
      {@render children()}
    {:else}
      <Icon icon={MenuDots} size={iconSize} />
    {/if}
  </Tippy>
</Button>
