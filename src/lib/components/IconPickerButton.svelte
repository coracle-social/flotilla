<script lang="ts">
  import {type Instance} from "tippy.js"
  import {between, throttle} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import IconPicker from "@app/components/IconPicker.svelte"

  const {...props} = $props()

  const open = () => popover?.show()

  const onClick = (iconUrl: string) => {
    props.onSelect(iconUrl)
    popover?.hide()
  }

  const onMouseMove = throttle(300, ({clientX, clientY}: any) => {
    if (popover) {
      const {x, width} = popover.popper.getBoundingClientRect()

      if (!between([x - 50, x + width + 50], clientX)) {
        popover.hide()
      }
    }
  })

  let popover: Instance | undefined = $state()
</script>

<svelte:document onmousemove={onMouseMove} />

<Tippy
  bind:popover
  component={IconPicker}
  props={{onSelect: onClick}}
  params={{trigger: "manual", interactive: true}}>
  <Button onclick={open} class={props.class}>
    {@render props.children?.()}
  </Button>
</Tippy>
