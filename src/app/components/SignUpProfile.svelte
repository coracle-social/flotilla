<script lang="ts">
  import type {Profile} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {getKey, setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"

  type Props = {
    next: () => void
  }

  const {next}: Props = $props()

  const profile = getKey<Profile>("signup.profile")!

  const initialValues = {profile, shouldBroadcast: false}

  const back = () => history.back()

  const onsubmit = ({profile}: {profile: Profile}) => {
    setKey("signup.profile", profile)
    next()
  }
</script>

<div class="flex flex-col gap-4">
  <ProfileEditForm isSignup {initialValues} {onsubmit}>
    {#snippet footer()}
      <ModalFooter>
        <Button class="btn btn-link" onclick={back}>
          <Icon icon={AltArrowLeft} />
          Go back
        </Button>
        <Button class="btn btn-primary" type="submit">
          Create Account
          <Icon icon={AltArrowRight} />
        </Button>
      </ModalFooter>
    {/snippet}
  </ProfileEditForm>
</div>
