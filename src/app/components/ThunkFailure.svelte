<script lang="ts">
  import {stopPropagation} from "svelte/legacy"
  import {noop} from "@welshman/lib"
  import type {AbstractThunk} from "@welshman/app"
  import {retryThunk, thunkIsComplete, getFailedThunkUrls} from "@welshman/app"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import ThunkStatusDetail from "@app/components/ThunkStatusDetail.svelte"
  import {pushToast} from "@app/util/toast"

  interface Props {
    thunk: AbstractThunk
    showToastOnRetry?: boolean
    class?: string
  }

  let {thunk, showToastOnRetry, ...restProps}: Props = $props()

  const retry = () => {
    thunk = retryThunk(thunk)

    if (showToastOnRetry) {
      pushToast({
        timeout: 30_000,
        children: {
          component: ThunkToast,
          props: {thunk},
        },
      })
    }
  }

  const failedUrls = $derived(getFailedThunkUrls($thunk))
  const showFailure = $derived(thunkIsComplete($thunk) && failedUrls.length > 0)
</script>

{#if showFailure}
  {@const url = failedUrls[0]}
  {@const {status, detail: message} = $thunk.results[url]}
  <button
    class="flex w-full justify-end px-1 text-xs {restProps.class}"
    onclick={stopPropagation(noop)}>
    <Tippy
      class="flex items-center"
      component={ThunkStatusDetail}
      props={{url, message, status, retry}}
      params={{interactive: true}}>
      {#snippet children()}
        <span class="flex cursor-pointer items-center gap-1 text-error">
          <Icon icon={Danger} size={3} />
          <span>Failed to send!</span>
        </span>
      {/snippet}
    </Tippy>
  </button>
{/if}
