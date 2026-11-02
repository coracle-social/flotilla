<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Props as TippyProps} from "tippy.js"
  import type {Maybe} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"

  type Props = {
    tippyParams?: Partial<TippyProps>
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

  let tippy: Maybe<TippyController> = $state()
</script>

<Button onclick={open} class={className} {...restProps}>
  <Tippy
    bind:controller={tippy}
    class="flex"
    component={EmojiPicker}
    strayMargin={allowKaomoji ? undefined : 100}
    props={{onClick, allowKaomoji}}
    params={{
      trigger: "manual",
      interactive: true,
      popperOptions: {
        modifiers: [
          // The picker is taller than half a laptop screen, so it flips to whichever
          // side fits whole — a react button low on a long page needs it above — and
          // preventOverflow shifts it back on screen along the other axis when even
          // that side is short. Without altAxis popper only acts on the placement
          // axis, so a picker taller than the space beside its trigger stays off it.
          {
            name: "flip",
            options: {fallbackPlacements: ["top", "bottom", "left", "right"], padding: 8},
          },
          {
            name: "preventOverflow",
            options: {boundary: "viewport", altAxis: true, padding: 8},
          },
        ],
      },
      ...tippyParams,
    }}>
    {@render children?.()}
  </Tippy>
</Button>
