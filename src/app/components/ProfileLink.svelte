<script lang="ts">
  import cx from "classnames"
  import {preventDefault} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {pushModal} from "@app/util/modal"

  type Props = {
    pubkey: string
    url?: string
    class?: string
    unstyled?: boolean
  }

  const {pubkey, url, unstyled, ...props}: Props = $props()

  const openProfile = () => pushModal(ProfileDetail, {pubkey, url})
</script>

<Button onclick={preventDefault(openProfile)} class={cx(props.class, {"link-content": !unstyled})}>
  @<ProfileName {pubkey} {url} />
</Button>
