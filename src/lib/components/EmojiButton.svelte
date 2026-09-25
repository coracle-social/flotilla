<script lang="ts">
  import type {Snippet} from "svelte"
  import {between, throttle} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"

  type Props = {
    tippyParams?: Record<string, unknown>
    onEmoji: (emoji: string) => void
    allowKaomoji?: boolean
    class?: string
    children?: Snippet
    [key: string]: unknown
  }

  const {
    tippyParams = {},
    onEmoji,
    allowKaomoji = false,
    class: className,
    children,
    ...restProps
  }: Props = $props()

  const open = () => tippy?.show()

  const onClick = (emoji: string) => {
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

<svelte:document onmousemove={tippy?.visible && !allowKaomoji ? onMouseMove : undefined} />

<Button onclick={open} class={className} {...restProps}>
  <Tippy
    bind:controller={tippy}
    class="flex"
    component={EmojiPicker}
    props={{onClick, allowKaomoji}}
    params={{trigger: "manual", interactive: true, ...tippyParams}}>
    {@render children?.()}
  </Tippy>
</Button>
