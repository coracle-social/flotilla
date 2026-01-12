<script lang="ts">
  import type {Profile} from "@welshman/util"
  import KeyDownload from "@app/components/KeyDownload.svelte"
  import SignUpComplete from "@app/components/SignUpComplete.svelte"
  import {pushModal} from "@app/util/modal"

  type Props = {
    secret: string
    profile: Profile
  }

  const props: Props = $props()

  const next = () => pushModal(SignUpComplete, props)
</script>

<KeyDownload {next} />
