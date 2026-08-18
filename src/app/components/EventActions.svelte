<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import EventMenu from "@app/components/EventMenu.svelte"
  import EventReactButtons from "@app/components/EventReactButtons.svelte"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
    hideZap?: boolean
    customActions?: Snippet
  }

  const {url, noun, event, hideZap, customActions}: Props = $props()

  const showPopover = () => tippy?.show()

  const hidePopover = () => tippy?.hide()

  let tippy: Maybe<TippyController> = $state()
</script>

<!-- The compact segmented control a card footer gets. EventActionBar is the full-width
     version a detail page gets. -->
<div class="items-center join">
  <EventReactButtons {url} {event} {hideZap} class="button button-neutral button-xs join-item" />
  <Button onclick={showPopover} class="flex join-item button button-neutral button-xs">
    <Tippy
      bind:controller={tippy}
      component={EventMenu}
      props={{url, noun, event, customActions, onClick: hidePopover}}
      params={{trigger: "manual", interactive: true}}>
      <Icon icon={MenuDots} size={4} />
    </Tippy>
  </Button>
</div>
