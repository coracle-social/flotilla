<script lang="ts">
  import {relay} from "@welshman/util"
  import {Pin} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import type {PinReader} from "@welshman/domain"
  import PinForm, {type PinFormValues} from "@app/components/PinForm.svelte"
  import {command, relays, writer} from "@app/core"
  import {pinToReference, setPinReference} from "@app/pinboards"

  type Props = {
    url: string
    pin: PinReader
  }

  const {url, pin}: Props = $props()

  const submit = async ({title, topics, value, content}: PinFormValues) => {
    const eventWriter = writer(Pin, pin)
      .setProtected(await $relays.hasNip(url, 70))
      .forceRoutes(relay(url))

    if (!setPinReference(eventWriter, value)) {
      return "Please enter a valid URL or nostr link."
    }

    eventWriter.setTitle(title).setTopics(topics).setContent(content)

    const thunk = await command(eventWriter).then(publish)

    return thunk.waitForError()
  }
</script>

<PinForm
  {url}
  heading="Edit Link"
  action="Save changes"
  successMessage="Link updated!"
  values={{
    title: pin.title(),
    topics: pin.topics(),
    value: pinToReference(pin),
    content: pin.content(),
  }}
  {submit} />
