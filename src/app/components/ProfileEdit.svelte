<script lang="ts">
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import type {Values} from "@app/components/ProfileEditForm.svelte"
  import {clearModals} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {profiles, user} from "@app/core"

  const initialValues = {profile: {...$profiles.get($user.pubkey)?.values}}

  const back = () => history.back()

  const onsubmit = async ({profile}: Values) => {
    loading = true

    try {
      const command = await $profiles.update(writer => writer.update(profile))
      const error = await command.publish().waitForError()

      if (error) {
        pushToast({
          theme: "error",
          message: `Failed to update your profile: ${errorMessage(error)}`,
        })
      } else {
        pushToast({message: "Your profile has been updated!"})
        clearModals()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update your profile."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<ProfileEditForm {initialValues} {onsubmit}>
  {#snippet footer()}
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go Back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading} />
      Save Changes
    </Button>
  {/snippet}
</ProfileEditForm>
