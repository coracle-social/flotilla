<script lang="ts">
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileInfo from "@app/components/ProfileInfo.svelte"
  import ProfileQrCode from "@app/components/ProfileQrCode.svelte"
  import {profiles} from "@app/core"
  import {pushModal} from "@app/modal"

  type Props = {
    pubkey: string
    url?: string
    onClick: () => void
    customActions?: Snippet
  }

  const {pubkey, url, onClick, customActions}: Props = $props()

  const profile = $profiles.one(pubkey, removeUndefined([url]))

  const showInfo = () => pushModal(ProfileInfo, {event: $profile!.event, url})

  const showShare = () => pushModal(ProfileQrCode, {pubkey})

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  <li>
    <Button onclick={showShare}>
      <Icon size={4} icon={ShareCircle} />
      Share
    </Button>
  </li>
  {#if $profile}
    <li>
      <Button onclick={showInfo}>
        <Icon size={4} icon={Code2} />
        Profile Info
      </Button>
    </li>
  {/if}
  {@render customActions?.()}
</ul>
