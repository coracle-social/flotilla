<script lang="ts">
  import type {Profile} from "@welshman/util"
  import {createProfile, PROFILE, makeEvent} from "@welshman/util"
  import {publishThunk, loginWithNip01} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {PROTECTED} from "@app/state"

  type Props = {
    secret: string
    profile: Profile
  }

  const {secret, profile}: Props = $props()

  const back = () => history.back()

  const next = () => {
    const template = createProfile(profile)

    // Start out protected by default
    template.tags.push(PROTECTED)

    const event = makeEvent(PROFILE, template)

    // Log in first, then publish
    loginWithNip01(secret)

    // Don't publish anywhere yet, wait until they join a space
    publishThunk({event, relays: []})
  }
</script>

<form class="column gap-4" onsubmit={preventDefault(next)}>
  <ModalHeader>
    {#snippet title()}
      <div>You're all set!</div>
    {/snippet}
  </ModalHeader>
  <p>
    You've created your profile, saved your keys, and now you're ready to start chatting — all
    without asking permission!
  </p>
  <p>
    From your dashboard, you can use invite links, discover community spaces, and keep up-to-date on
    groups you've already joined. Click below to get started!
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    <Button class="btn btn-primary" type="submit">
      <Icon icon="home-smile" />
      Go to Dashboard
    </Button>
  </ModalFooter>
</form>
