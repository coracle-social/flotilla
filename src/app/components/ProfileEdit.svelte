<script lang="ts">
  import {nthNe} from "@welshman/lib"
  import type {Profile} from "@welshman/util"
  import {
    getTag,
    makeEvent,
    makeProfile,
    editProfile,
    createProfile,
    isPublishedProfile,
    uniqTags,
  } from "@welshman/util"
  import {Router} from "@welshman/router"
  import {pubkey, profilesByPubkey, publishThunk} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import {clearModals} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {PROTECTED, getMembershipUrls, userMembership} from "@app/state"

  const profile = $profilesByPubkey.get($pubkey!) || makeProfile()
  const shouldBroadcast = !getTag(PROTECTED, profile.event?.tags || [])
  const initialValues = {profile, shouldBroadcast}

  const back = () => history.back()

  const onsubmit = ({profile, shouldBroadcast}: {profile: Profile; shouldBroadcast: boolean}) => {
    const router = Router.get()
    const template = isPublishedProfile(profile) ? editProfile(profile) : createProfile(profile)
    const scenarios = [router.FromRelays(getMembershipUrls($userMembership))]

    if (shouldBroadcast) {
      scenarios.push(router.FromUser(), router.Index())
      template.tags = template.tags.filter(nthNe(0, "-"))
    } else {
      template.tags = uniqTags([...template.tags, PROTECTED])
    }

    const event = makeEvent(template.kind, template)
    const relays = router.merge(scenarios).getUrls()

    publishThunk({event, relays})
    pushToast({message: "Your profile has been updated!"})
    clearModals()
  }
</script>

<ProfileEditForm {initialValues} {onsubmit}>
  {#snippet footer()}
    <div class="mt-4 flex flex-row items-center justify-between gap-4">
      <Button class="btn btn-neutral" onclick={back}>Discard Changes</Button>
      <Button type="submit" class="btn btn-primary">Save Changes</Button>
    </div>
  {/snippet}
</ProfileEditForm>
