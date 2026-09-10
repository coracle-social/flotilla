<script lang="ts">
  import {stopPropagation} from "svelte/legacy"
  import {noop} from "@welshman/lib"
  import type {BaseThunk} from "@welshman/app"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import ThunkStatusDetail from "@app/components/ThunkStatusDetail.svelte"
  import {thunks} from "@app/core"
  import {pushToast} from "@app/toast"

  type Props = {
    thunk: BaseThunk
    showToastOnRetry?: boolean
    class?: string
  }

  const {thunk, showToastOnRetry, ...restProps}: Props = $props()

  const showFailure = $derived($thunk.isComplete() && $thunk.getFailedUrls().length > 0)

  const retry = (url: string) => {
    for (const child of $thunks.flatten([thunk])) {
      if (child.options.relays.includes(url)) {
        const retried = $thunks.publish({...child.options, event: child.event, relays: [url]})

        if (showToastOnRetry) {
          pushToast({
            timeout: 30_000,
            children: {
              component: ThunkToast,
              props: {thunk: retried},
            },
          })
        }

        return
      }
    }
  }
</script>

{#if showFailure}
  <button
    class="flex w-full justify-end px-1 text-xs {restProps.class}"
    onclick={stopPropagation(noop)}>
    <Tippy
      class="flex items-center"
      component={ThunkStatusDetail}
      props={{thunk, retry}}
      params={{interactive: true, maxWidth: "none", trigger: "click"}}>
      <span class="flex cursor-pointer items-center gap-1 opacity-75">
        <Icon icon={Danger} class="text-error" size={3} />
        <span>Failed to send!</span>
      </span>
    </Tippy>
  </button>
{/if}
