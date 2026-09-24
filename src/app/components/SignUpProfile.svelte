<script lang="ts">
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {getKey, setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileEditForm from "@app/components/ProfileEditForm.svelte"
  import type {Values} from "@app/components/ProfileEditForm.svelte"
  import ProgressBar from "@app/components/ProgressBar.svelte"

  type Props = {
    next: () => void
    step?: number
    totalSteps?: number
  }

  const {next, step, totalSteps}: Props = $props()

  const initialValues = {
    profile: getKey<Values["profile"]>("signup.profile")!,
    geohash: getKey<Values["geohash"]>("signup.geohash"),
  }

  const back = () => history.back()

  const onsubmit = ({profile, geohash}: Values) => {
    setKey("signup.profile", profile)
    setKey("signup.geohash", geohash)
    next()
  }
</script>

<ProfileEditForm isSignup {initialValues} {onsubmit}>
  {#snippet footer()}
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" type="submit">
      Create Account
      <Icon icon={AltArrowRight} />
    </Button>
  {/snippet}
  {#snippet progressBar()}
    {#if step && totalSteps}
      <ProgressBar current={step} total={totalSteps} />
    {/if}
  {/snippet}
</ProfileEditForm>
