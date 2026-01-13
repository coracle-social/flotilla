<script lang="ts">
  import type {Profile} from "@welshman/util"
  import {makeProfile, makeSecret} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import SignUpKey from "@app/components/SignUpKey.svelte"
  import SignUpEmail from "@app/components/SignUpEmail.svelte"
  import {pushModal} from "@app/util/modal"

  type Props = {
    flow: "nostr" | "email"
  }

  const {flow}: Props = $props()

  const initialValues = {
    secret: makeSecret(),
    profile: makeProfile(),
    shouldBroadcast: false,
  }

  const back = () => history.back()

  const onsubmit = (values: {profile: Profile}) =>
    pushModal(flow === "nostr" ? SignUpKey : SignUpEmail, values)
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
