<script lang="ts">
  import {chunk, sleep, uniq} from "@welshman/lib"
  import {makeEvent, DELETE, isReplaceable, getAddress} from "@welshman/util"
  import {Profile} from "@welshman/domain"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {INDEXER_RELAYS} from "@app/core/env"
  import {userSpaceUrls} from "@app/features/spaces"
  import {pushToast} from "@app/features/toast"
  import {logout} from "@app/core/session"
  import {app} from "@app/core/app"
  import {user} from "@app/core/user"
  import {publisher, relayLists} from "@app/core/plugins"
  import {writer} from "@app/core/domain"

  let progress: number | undefined = $state(undefined)
  let confirmText = $state("")

  const CONFIRM_TEXT = "permanently delete my account"
  const userWriteRelays = $relayLists.writeUrls($user.pubkey).$
  const confirmOk = $derived(confirmText.toLowerCase().trim() === CONFIRM_TEXT)
  const showProgress = $derived(progress !== undefined)

  const deleteProfile = async () => {
    if (!confirmOk) {
      return pushToast({
        theme: "error",
        message: "Please type your confirmation into the text box.",
      })
    }

    const chunks = chunk(500, $app.repository.query([{authors: [$user.pubkey]}]))
    const profileEvent = await writer(Profile).setName("[deleted]").renderTemplate()
    const vanishEvent = makeEvent(62, {tags: [["relay", "ALL_RELAYS"]]})
    const denominator = chunks.length + 2
    const relays = uniq([...INDEXER_RELAYS, ...$userWriteRelays, ...$userSpaceUrls])

    let step = 0

    const incrementProgress = async () => {
      progress = ++step / denominator

      return sleep(800)
    }

    // First, blank out their profile in case relays don't support deletion by address
    await $publisher.publish({relays, event: profileEvent})

    await incrementProgress()

    // Next, send a "right to vanish" event to all relays
    await $publisher.publish({relays, event: vanishEvent})

    await incrementProgress()

    // Finally, send deletion requests for all known events in case relays don't support right to vanish
    for (const events of chunks) {
      const tags: string[][] = []

      for (const event of events) {
        tags.push(["e", event.id])

        if (isReplaceable(event)) {
          tags.push(["a", getAddress(event)])
        }
      }

      await $publisher.publish({relays, event: makeEvent(DELETE, {tags})})

      await incrementProgress()
    }

    // Let them see that progress is complete
    await sleep(2000)

    // Goodbye forever!
    await logout()
  }

  const confirm = async () => {
    progress = 0

    try {
      await deleteProfile()
    } catch (e) {
      progress = undefined

      throw e
    }
  }

  const back = () => history.back()
</script>

<Modal tag="form" onsubmit={preventDefault(confirm)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Delete your account</ModalTitle>
    </ModalHeader>
    {#if showProgress}
      <p>
        We're deleting your account. Please wait while we finish. Once we're done, you'll be
        automatically logged out.
      </p>
      <progress class="progress w-full" value={progress! * 100} max="100"></progress>
    {:else}
      <p>This will permanently delete your account.</p>
      <p>
        To confirm, please type "{CONFIRM_TEXT}" into the text box below. This action can't be
        undone.
      </p>
      <label class="input input-group flex w-full items-center gap-2">
        <input bind:value={confirmText} class="grow" type="text" />
      </label>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-error" disabled={showProgress || !confirmOk}>
      <Spinner loading={progress !== undefined}>Confirm</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
