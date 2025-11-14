<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {formatTimestamp} from "@welshman/lib"
  import {getListTags, getPubkeyTagValues} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {userMutes} from "@welshman/app"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {goToEvent} from "@app/util/routes"

  const {
    event,
    children,
    minimal = false,
    hideProfile = false,
    url,
    ...restProps
  }: {
    event: TrustedEvent
    children: Snippet
    minimal?: boolean
    hideProfile?: boolean
    url?: string
    class?: string
  } = $props()

  const ignoreMute = () => {
    muted = false
  }

  let muted = $state(getPubkeyTagValues(getListTags($userMutes)).includes(event.pubkey))
</script>

<div class="flex flex-col gap-2 {restProps.class}">
  {#if muted}
    <div class="flex items-center justify-between">
      <div class="row-2 relative">
        <Icon icon={Danger} class="mt-1" />
        <p>You have muted this person.</p>
      </div>
      <Button class="link ml-8" onclick={ignoreMute}>Show anyway</Button>
    </div>
  {:else}
    <div class="flex justify-between gap-2">
      {#if !hideProfile}
        {#if minimal}
          @<ProfileName pubkey={event.pubkey} {url} />
        {:else}
          <Profile pubkey={event.pubkey} {url} />
        {/if}
      {/if}
      <Button
        class={cx("text-sm opacity-75", {"text-xs": minimal})}
        onclick={() => goToEvent(event)}>
        {formatTimestamp(event.created_at)}
      </Button>
    </div>
    {@render children()}
  {/if}
</div>
