<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
  import {displayRelayUrl} from "@welshman/util"
  import ArrowLeft from "@assets/icons/arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import {decodeRelay} from "@app/relays"

  interface Props {
    back?: () => unknown
    leading?: Snippet
    title?: Snippet
    action?: Snippet
    [key: string]: any
  }

  const {back, leading, title, action, ...props}: Props = $props()

  const url = decodeRelay($page.params.relay!)
</script>

<PageBar {...props}>
  <div class="flex min-w-0">
    {#if back}
      <Button onclick={back} aria-label="Go back" class="place-self-start pr-3 md:hidden">
        <Icon icon={ArrowLeft} size={7} />
      </Button>
    {/if}
    <div class="flex min-w-0 grow items-center justify-between gap-4">
      <div class="flex min-w-0 grow flex-col">
        <div class="flex min-w-0 items-start gap-2">
          <div class="hidden shrink-0 md:flex md:items-center place-self-center">
            {@render leading?.()}
          </div>
          <div class="min-w-0">
            {@render title?.()}
          </div>
        </div>
        <div class="truncate text-xs text-primary md:hidden">
          {displayRelayUrl(url)}
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        {@render action?.()}
      </div>
    </div>
  </div>
</PageBar>
