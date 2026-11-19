<script lang="ts">
  import {spec} from "@welshman/lib"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {getProfileGeohash} from "@lib/location"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import type {Values} from "@app/components/ProfileEditForm.svelte"
  import {clearModals} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"
  import {user} from "@app/core/user"
  import {profiles} from "@app/core/plugins"
  import {trackSubmit} from "@app/components/flows/submit"

  const existingProfile = $profiles.get($user.pubkey)

  const initialValues = {
    profile: {...existingProfile?.values},
    geohash: getProfileGeohash(existingProfile),
  }

  const back = () => history.back()

  const {loading, submit: onsubmit} = trackSubmit(
    () => "Failed to update your profile.",
    async ({profile, geohash}: Values) => {
      const command = await $profiles.update(writer => {
        writer.update(profile).dropTags(spec(["g"]))

        return geohash ? writer.addTags(["g", geohash]) : writer
      })
      const error = await command.publish().getFatalError()

      if (error) {
        pushToast({
          theme: "error",
          message: `Failed to update your profile: ${errorMessage(error)}`,
        })
      } else {
        pushToast({message: "Your profile has been updated!"})
        clearModals()
      }
    },
  )
</script>

<ProfileEditForm {initialValues} {onsubmit}>
  {#snippet footer()}
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go Back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$loading}>
      <Spinner loading={$loading} />
      Save Changes
    </Button>
  {/snippet}
</ProfileEditForm>
