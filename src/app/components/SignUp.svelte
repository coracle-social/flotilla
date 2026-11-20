<script lang="ts">
  import {assoc} from "@welshman/lib"
  import type {ClientOptions} from "@pomade/core"
  import {makeSecret, RELAYS, MESSAGING_RELAYS, makeEvent} from "@welshman/util"
  import {Profile} from "@welshman/domain"
  import {Publisher, nip01, toSession} from "@welshman/app"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import {getKey, setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import InfoNostr from "@app/components/InfoNostr.svelte"
  import SignUpMenu from "@app/components/SignUpMenu.svelte"
  import SignUpEmail from "@app/components/SignUpEmail.svelte"
  import SignUpProfile from "@app/components/SignUpProfile.svelte"
  import type {ProfileValues} from "@app/components/ProfileEditForm.svelte"
  import SignUpComplete from "@app/components/SignUpComplete.svelte"
  import {attemptRelayAccess} from "@app/areas/spaces/membership"
  import {
    PLATFORM_NAME,
    POMADE_SIGNERS,
    INDEXER_RELAYS,
    DEFAULT_RELAYS,
    DEFAULT_MESSAGING_RELAYS,
    DEFAULT_SPACES,
    HIDE_NOSTR,
  } from "@app/core/env"
  import {forceHealthChecks} from "@app/areas/home/healthChecks"
  import {loginWithPomade} from "@app/core/pomade"
  import {publishRoomList} from "@app/tools/publish"
  import {clearModals, pushModal} from "@app/navigation/dialogs"
  import {app} from "@app/core/app"
  import {domain, roomLists} from "@app/core/plugins"
  import {login} from "@app/core/session"

  setKey("signup.email", "")
  setKey("signup.secret", makeSecret())
  setKey("signup.profile", {})
  setKey("signup.geohash", undefined)
  setKey("signup.clientOptions", undefined)

  const hasPomade = POMADE_SIGNERS.length >= 3

  const showLogIn = () => pushModal(LogIn, {}, {replaceState: true})

  const showInfoNostr = () => pushModal(InfoNostr)

  const completeSignup = async () => {
    // Join default spaces so the relay is warmed up before we publish below
    await Promise.all(DEFAULT_SPACES.map(url => attemptRelayAccess(url)))

    const geohash = getKey<string>("signup.geohash")
    const profileWriter = $domain.writer(Profile).update(getKey<ProfileValues>("signup.profile")!)

    if (geohash) {
      profileWriter.addTags(["g", geohash])
    }

    // Add default outbox/inbox/messaging relays, profile, spaces
    const publications = await Promise.all([
      $app.use(Publisher).publish({
        event: makeEvent(RELAYS, {tags: DEFAULT_RELAYS.map(url => ["r", url])}),
        relays: [...INDEXER_RELAYS, ...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      $app.use(Publisher).publish({
        event: makeEvent(MESSAGING_RELAYS, {tags: DEFAULT_MESSAGING_RELAYS.map(url => ["r", url])}),
        relays: [...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      $app.use(Publisher).publish({
        event: await profileWriter.renderTemplate(),
        relays: DEFAULT_RELAYS,
      }),
      $roomLists.setRelays(DEFAULT_SPACES).then(publishRoomList),
    ])

    // Wait for all the publications to settle
    await Promise.all(publications.map(publication => publication.settled()))

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

        await loginWithPomade(clientOptions, email)
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
    {#if HIDE_NOSTR}
      <ModalTitle>Sign up</ModalTitle>
    {:else}
      <ModalTitle>Sign up with Nostr</ModalTitle>
      <p class="m-auto max-w-sm text-center">
        {PLATFORM_NAME} is built using the
        <Button class="link" onclick={showInfoNostr}>nostr protocol</Button>, which allows you to
        own your social identity.
      </p>
    {/if}
    {#if hasPomade}
      <div class="join">
        <Button
          onclick={flows.email.start}
          class="button button-primary join-item grow rounded-l-2xl">
          <Icon icon={Letter} />
          Sign up with email
        </Button>
        <MenuButton
          aria-label="More ways to sign up"
          component={SignUpMenu}
          componentProps={{signUpWithKey: flows.nostr.start}}
          class="button button-primary join-item rounded-r-2xl">
          <Icon icon={AltArrowDown} size={4} />
        </MenuButton>
      </div>
    {:else}
      <Button onclick={flows.nostr.start} class="button button-primary">
        <Icon icon={Key} />
        {HIDE_NOSTR ? "Sign up" : "Generate a key"}
      </Button>
    {/if}
    <Divider>Or</Divider>
    <Button onclick={showLogIn} class="button button-neutral">
      <Icon icon={Login} />
      Log in instead
    </Button>
  </ModalBody>
</Modal>
