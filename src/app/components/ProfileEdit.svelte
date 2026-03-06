<script lang="ts">
  import type {Profile} from "@welshman/util"
  import {getTag, makeProfile} from "@welshman/util"
  import {pubkey, profilesByPubkey, waitForThunkError} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import {clearModals} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {PROTECTED} from "@app/core/state"
  import {updateProfile} from "@app/core/commands"

  const profile = $profilesByPubkey.get($pubkey!) || makeProfile()
  const shouldBroadcast = !getTag(PROTECTED, profile.event?.tags || [])
  const initialValues = {profile, shouldBroadcast}

  const back = () => history.back()

  const onsubmit = async ({
    profile,
    shouldBroadcast,
  }: {
    profile: Profile
    shouldBroadcast: boolean
  }) => {
    loading = true

    try {
      const error = await waitForThunkError(updateProfile({profile, shouldBroadcast}))

      if (error) {
        pushToast({
          theme: "error",
          message: `Failed to update your profile: ${errorMessage(error)}`,
        })
      } else {
        pushToast({message: "Your profile has been updated!"})
        clearModals()
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<ProfileEditForm {initialValues} {onsubmit}>
  {#snippet footer()}
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go Back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading} />
      Save Changes
    </Button>
  {/snippet}
</ProfileEditForm>
