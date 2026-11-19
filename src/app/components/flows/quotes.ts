import {EventRef} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {app} from "@app/core/app"
import {pushModal} from "@app/navigation/dialogs"
import {goToEvent} from "@app/navigation/locations"
import {makeQuoteContent} from "@app/tools/quotes"
import NoteCreate from "@app/components/NoteCreate.svelte"
import QuoteLoading from "@app/components/QuoteLoading.svelte"
import {withLogin} from "@app/components/flows/login"

// A quote names an event that may not have arrived, so a modal loads it before going anywhere.
export const goToQuote = async (ref: IEventRef, event: TrustedEvent, url?: string) => {
  const idOrAddress = new EventRef(ref).getIdOrAddress()
  const loaded = idOrAddress ? await app.get().repository.getEvent(idOrAddress) : undefined

  if (loaded) {
    goToEvent(loaded)
  } else {
    pushModal(QuoteLoading, {ref, event, url})
  }
}

export const quoteEvent = (event: TrustedEvent) =>
  withLogin("quote this", async () => {
    const content = await makeQuoteContent(event)

    pushModal(NoteCreate, {initialValues: {content}})
  })
