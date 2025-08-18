<script lang="ts">
  import type {Profile} from "@welshman/util"
  import {makeProfile} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import SignUpKey from "@app/components/SignUpKey.svelte"
  import {pushModal} from "@app/modal"

  const initialValues = {
    profile: makeProfile(),
    shouldBroadcast: false,
  }

  const back = () => history.back()

  const onsubmit = (values: {profile: Profile}) => pushModal(SignUpKey, values)
</script>

<div class="flex flex-col gap-4">
  <ProfileEditForm isSignup {initialValues} {onsubmit}>
    {#snippet footer()}
      <ModalFooter>
        <Button class="btn btn-link" onclick={back}>
          <Icon icon="alt-arrow-left" />
          Go back
        </Button>
        <Button class="btn btn-primary" type="submit">
          Create Account
          <Icon icon="alt-arrow-right" />
        </Button>
      </ModalFooter>
    {/snippet}
  </ProfileEditForm>
</div>
