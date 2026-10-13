<script lang="ts">
  import {onMount} from "svelte"
  import {Share} from "@capacitor/share"
  import {randomId, sleep} from "@welshman/lib"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Upload from "@assets/icons/upload.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import {deriveRelayAuthError, makeInviteLink, publishRoomInvite} from "@app/features/access"
  import {relayManagement} from "@app/core/plugins"
  import {PLATFORM_NAME} from "@app/core/env"
  import {spaceManagement} from "@app/core/management"
  import {clip} from "@app/ui/toast"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const authError = deriveRelayAuthError(url)

  const copyInvite = () => clip(invite)

  const shareInvite = async () => {
    try {
      await Share.share({url: invite})
    } catch (e) {
      console.error(e)
    }
  }

  const prepareInvite = async () => {
    try {
      const management = relayManagement.get().forUrl(url)

      const [methods, roomInvite] = await Promise.all([
        spaceManagement.get().loadSupportedMethods(url),
        h ? publishRoomInvite(url, h) : Promise.resolve({code: undefined, error: undefined}),
        // Keep the spinner up long enough that a fast relay doesn't make it flash
        sleep(300),
      ])

      // A relay reporting methods relay-wide can still come back "blocked" for this user.
      if (methods.includes("createclaim")) {
        const {result: claims} = await management.listClaims()

        if (claims?.[0]) {
          claim = claims[0]
        } else {
          const newClaim = randomId()
          const {error} = await management.createClaim(newClaim)

          if (error) {
            claimFailed = true
          } else {
            claim = newClaim
          }
        }
      }

      roomCode = roomInvite.code
      roomInviteError = roomInvite.error
    } catch (e) {
      console.error(e)
      claimFailed = true
    } finally {
      loading = false
    }
  }

  let loading = $state(true)
  let claim = $state("")
  let claimFailed = $state(false)
  let roomCode = $state<string>()
  let roomInviteError = $state<string>()
  let canShare = $state(false)

  const invite = $derived(makeInviteLink({url, claim, h, code: roomCode}))

  onMount(async () => {
    try {
      const {value} = await Share.canShare()
      canShare = value
    } catch {
      canShare = false
    }

    await prepareInvite()
  })
</script>

<div>
  {#if loading}
    <p class="flex justify-center items-center">
      <Spinner {loading}>Requesting an invite link...</Spinner>
    </p>
  {:else if $authError && /failed|timeout|network/i.test($authError)}
    <p class="flex justify-center items-center">
      Unable to reach the space. Please check your connection and try again.
    </p>
  {:else if $authError || roomInviteError}
    <p class="flex justify-center items-center">
      {#if h}
        Oops! It looks like you're not allowed to create invites for this room.
      {:else}
        Oops! It looks like you're not a member of this space.
      {/if}
    </p>
  {:else if h && !roomCode}
    <p class="flex justify-center items-center">Unable to create a room invite code.</p>
  {:else}
    <div class="flex flex-col items-center gap-6">
      <div class="w-48">
        <QRCode code={invite} />
      </div>
      <Field>
        {#snippet input()}
          <div class="flex w-full gap-2">
            {#if canShare}
              <Button
                class="input flex w-12 shrink-0 items-center justify-center p-0"
                onclick={shareInvite}>
                <Icon icon={Upload} />
              </Button>
            {/if}

            <label class="input flex min-w-0 flex-1 items-center gap-2">
              <Icon icon={LinkRound} class="shrink-0" />
              <input value={invite} class="min-w-0 flex-1 truncate" type="text" readonly />
              <Button class="shrink-0" onclick={copyInvite}>
                <Icon icon={Copy} />
              </Button>
            </label>
          </div>
        {/snippet}
        {#snippet info()}
          <p>
            {#if h}
              This invite link includes access to the space and room. Anyone with the link can join
              by opening it in {PLATFORM_NAME}.
            {:else}
              This invite link can be used by clicking "Add Space" and pasting it there.
            {/if}
            {#if claimFailed}
              We weren't able to get an invite code from this space, so additional steps might be
              required.
            {:else if !claim}
              This space did not issue a claim for this link, so additional steps might be required.
            {/if}
          </p>
        {/snippet}
      </Field>
    </div>
  {/if}
</div>
