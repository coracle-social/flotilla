<script lang="ts">
  import cx from "classnames"
  import type {PinboardReader} from "@welshman/domain"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import BoardMenu from "@app/components/BoardMenu.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makeLibraryPath} from "@app/routes"

  type Props = {
    url: string
    board: PinboardReader
    selected: boolean
    onclick: () => void
  }

  const {url, board, selected, onclick}: Props = $props()

  const path = $derived(makeLibraryPath(url, board.address()))
</script>

<div class="relative w-56 shrink-0">
  <Button
    {onclick}
    aria-pressed={selected}
    class={cx("card card-sm card-interactive flex h-full w-full flex-col items-start gap-1 pr-10", {
      "card-primary": selected,
    })}>
    <strong class="truncate w-full text-left"
      ><UnreadDot {path} class="mr-1" />{board.title() || "Untitled shelf"}</strong>
    {#if board.description()}
      <span class="line-clamp-2 text-left text-sm opacity-70">{board.description()}</span>
    {/if}
  </Button>
  <div class="absolute right-2 top-2 z-feature">
    <MenuButton
      class="button button-neutral button-sm button-square"
      aria-label="More options"
      iconSize={4}
      component={BoardMenu}
      componentProps={{url, board}} />
  </div>
</div>
