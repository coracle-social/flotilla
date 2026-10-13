<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Maybe} from "@welshman/lib"
  import {isMobile} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import IconPickerModal from "@app/components/IconPickerModal.svelte"
  import IconPickerPopover from "@app/components/IconPickerPopover.svelte"
  import {pushModal, popModal} from "@app/ui/modal"

  type Props = {
    onSelect: (iconUrl: string) => void
    class?: string
    children?: Snippet
  }

  const {onSelect, children, ...props}: Props = $props()

  const open = () => {
    if (isMobile) {
      pushModal(IconPickerModal, {onSelect: onClick}, {nested: true})
    } else {
      tippy?.show()
    }
  }

  const close = () => {
    if (isMobile) {
      popModal()
    } else {
      tippy?.hide()
    }
  }

  const onClick = (iconUrl: string) => {
    onSelect(iconUrl)
    close()
  }

  let tippy: Maybe<TippyController> = $state()
</script>

<Tippy
  bind:controller={tippy}
  component={IconPickerPopover}
  strayMargin={50}
  props={{onSelect: onClick}}
  params={{trigger: "manual", interactive: true, placement: "top-end"}}>
  <Button onclick={open} class={props.class}>
    {@render children?.()}
  </Button>
</Tippy>
