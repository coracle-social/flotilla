<script lang="ts">
  import {fromPairs} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getTag, getTagValues} from "@welshman/util"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ClassifiedForm from "@app/components/ClassifiedForm.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const {content} = event
  const {d, title, status} = fromPairs(event.tags)
  const [_, price = 0, currency = "SAT"] = getTag("price", event.tags) || []
  const images = getTagValues("image", event.tags)
  const topics = getTagValues("t", event.tags)
  const initialValues = {d, title, status, content, price: Number(price), currency, images, topics}
</script>

<ClassifiedForm {url} {initialValues}>
  {#snippet header()}
    <ModalHeader>
      <ModalTitle>Edit this Listing</ModalTitle>
      <ModalSubtitle>Advertise a job, sale, or need.</ModalSubtitle>
    </ModalHeader>
  {/snippet}
</ClassifiedForm>
