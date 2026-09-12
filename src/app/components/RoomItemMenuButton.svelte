<script lang="ts">
  import {between} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import RoomItemMenu from "@app/components/RoomItemMenu.svelte"

  const {url, event} = $props()

  const open = () => tippy?.show()

  const onClick = () => tippy?.hide()

  const onMouseMove = ({clientX, clientY}: MouseEvent) => {
    const rect = tippy?.rect()

    if (rect) {
      const {x, y, width, height} = rect

      if (!between([x, x + width], clientX) || !between([y - 50, y + height + 50], clientY)) {
        tippy!.hide()
      }
    }
  }

  let tippy: Maybe<TippyController> = $state()
</script>

<svelte:document onmousemove={tippy?.visible ? onMouseMove : undefined} />

<Button aria-label="More options" onclick={open} class="button button-xs button-neutral join-item">
  <Tippy
    bind:controller={tippy}
    component={RoomItemMenu}
    props={{url, event, onClick}}
    params={{trigger: "manual", interactive: true}}>
    <Icon icon={MenuDots} size={4} />
  </Tippy>
</Button>
