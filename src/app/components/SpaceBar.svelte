<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
  import ArrowLeft from "@assets/icons/arrow-left.svg?dataurl"
  import {fade} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import RelayLabel from "@app/components/RelayLabel.svelte"
  import {pageLoading} from "@app/features/loading"
  import {decodeRelay} from "@app/navigation/pages"

  type Props = {
    back?: () => unknown
    leading?: Snippet
    title?: Snippet
    action?: Snippet
    class?: string
  }

  const {back, leading, title, action, ...props}: Props = $props()

  const relay = $page.params.relay
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
          {#if $pageLoading}
            <div transition:fade={{duration: 200}} class="shrink-0 place-self-center">
              <Spinner size="xs" />
            </div>
          {/if}
        </div>
        {#if relay}
          <div class="truncate text-xs text-primary md:hidden">
            <RelayLabel url={decodeRelay(relay)} />
          </div>
        {/if}
      </div>
      <div class="flex shrink-0 items-center gap-2">
        {@render action?.()}
      </div>
    </div>
  </div>
</PageBar>
