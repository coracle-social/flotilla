<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import {between, throttle} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"

  const {tippyParams = {}, onEmoji, class: className, children, ...restProps} = $props()

  const open = () => tippy?.show()

  const onClick = (emoji: NativeEmoji) => {
    onEmoji(emoji)
    tippy?.hide()
  }

  const onMouseMove = throttle(300, ({clientX, clientY}: MouseEvent) => {
    const rect = tippy?.rect()

    if (rect) {
      const {x, y, width, height} = rect

      if (!between([x, x + width], clientX) || !between([y - 100, y + height + 100], clientY)) {
        tippy!.hide()
      }
    }
  })

  let tippy: Maybe<TippyController> = $state()
</script>

<svelte:document onmousemove={tippy?.visible ? onMouseMove : undefined} />

<Button onclick={open} class={className} {...restProps}>
  <Tippy
    bind:controller={tippy}
    class="flex"
    component={EmojiPicker}
    props={{onClick}}
    params={{trigger: "manual", interactive: true, ...tippyParams}}>
    {@render children?.()}
  </Tippy>
</Button>
