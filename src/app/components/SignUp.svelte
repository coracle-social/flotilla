<script lang="ts">
  import cx from "classnames"
  import type {ClientOptions} from "@pomade/core"
  import {assoc} from "@welshman/lib"
  import {makeSecret, RELAYS, MESSAGING_RELAYS, makeEvent} from "@welshman/util"
  import {Profile} from "@welshman/domain"
  import {Thunks, nip01, publish, toSession} from "@welshman/app"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import {getKey, setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import SignUpEmail from "@app/components/SignUpEmail.svelte"
  import SignUpProfile from "@app/components/SignUpProfile.svelte"
  import type {ProfileValues} from "@app/components/ProfileEditForm.svelte"
  import SignUpComplete from "@app/components/SignUpComplete.svelte"
  import {attemptRelayAccess} from "@app/access"
  import {
    POMADE_SIGNERS,
    INDEXER_RELAYS,
    DEFAULT_RELAYS,
    DEFAULT_MESSAGING_RELAYS,
    DEFAULT_SPACES,
  } from "@app/env"
  import {setChecked} from "@app/notifications"
  import {forceHealthChecks} from "@app/healthChecks"
  import {loginWithPomade} from "@app/pomade"
  import {pushModal, clearModals} from "@app/modal"
  import {app, domain, login, roomLists} from "@app/core"

  setKey("signup.email", "")
  setKey("signup.secret", makeSecret())
  setKey("signup.profile", {})
  setKey("signup.clientOptions", undefined)

  const hasPomade = POMADE_SIGNERS.length >= 3

  const showLogIn = () => pushModal(LogIn)

  const completeSignup = async () => {
    // Join default spaces so the relay is warmed up before we publish below
    await Promise.all(DEFAULT_SPACES.map(url => attemptRelayAccess(url)))

    // Add default outbox/inbox/messaging relays, profile, spaces
    const thunks = await Promise.all([
      $app.use(Thunks).publish({
        event: makeEvent(RELAYS, {tags: DEFAULT_RELAYS.map(url => ["r", url])}),
        relays: [...INDEXER_RELAYS, ...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      $app.use(Thunks).publish({
        event: makeEvent(MESSAGING_RELAYS, {tags: DEFAULT_MESSAGING_RELAYS.map(url => ["r", url])}),
        relays: [...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      $app.use(Thunks).publish({
        event: await $domain
          .writer(Profile)
          .update(getKey<ProfileValues>("signup.profile")!)
          .renderTemplate(),
        relays: [...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      $roomLists.setRelays(DEFAULT_SPACES).then(publish),
    ])

    // Wait for all the thunks to complete
    await Promise.all(thunks.map(thunk => thunk.waitForCompletion()))

    // Don't show any notifications for old content
    setChecked("*")

    // Go to the dashboard
    clearModals()
  }

  const flows = {
    email: {
      start: () => pushModal(SignUpEmail, {next: flows.email.profile, step: 1, totalSteps: 3}),
      profile: () => pushModal(SignUpProfile, {next: flows.email.complete, step: 2, totalSteps: 3}),
      complete: () =>
        pushModal(SignUpComplete, {next: flows.email.finalize, step: 3, totalSteps: 3}),
      finalize: async () => {
        const email = getKey<string>("signup.email")!
        const clientOptions = getKey<ClientOptions>("signup.clientOptions")!

        loginWithPomade(clientOptions, email)
        await completeSignup()
      },
    },
    nostr: {
      start: () => pushModal(SignUpProfile, {next: flows.nostr.complete, step: 1, totalSteps: 2}),
      complete: () =>
        pushModal(SignUpComplete, {next: flows.nostr.finalize, step: 2, totalSteps: 2}),
      finalize: async () => {
        const secret = getKey<string>("signup.secret")!

        await login(toSession(nip01, {secret}))
        forceHealthChecks.update(assoc("backup-key", true))
        await completeSignup()
      },
    },
  }
</script>

<Modal>
  <ModalBody>
    <ModalTitle>Create an Account</ModalTitle>
    <p class="m-auto max-w-sm text-center">
      Get started in just a few clicks by picking one of the options below.
    </p>
    {#if hasPomade}
      <Button onclick={flows.email.start} class="button button-primary">
        <Icon icon={Letter} />
        Sign up with email
      </Button>
    {/if}
    <Button
      onclick={flows.nostr.start}
      class={cx(`button button-${hasPomade ? "neutral" : "primary"}`)}>
      <Icon icon={Key} />
      Generate a key
    </Button>
    <div class="text-sm">
      Already have an account?
      <Button class="link" onclick={showLogIn}>Log in instead</Button>
    </div>
  </ModalBody>
</Modal>
