<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import type {ProfilePointer} from "@welshman/content"
  import {deriveProfileDisplay} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {pushModal} from "@app/util/modal"

  type Props = {
    value: ProfilePointer
    url?: string
  }

  const {value, url}: Props = $props()

  const display = deriveProfileDisplay(value.pubkey, removeUndefined([url]))

  const openProfile = () => pushModal(ProfileDetail, {pubkey: value.pubkey, url})
</script>

<Button onclick={openProfile} class="link-content">
  @{$display}
</Button>
