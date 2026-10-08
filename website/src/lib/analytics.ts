// Plausible goal tags for the conversion funnel.
//
// BaseLayout loads the `outbound-links.tagged-events` tracker. Outbound clicks are
// recorded on their own as "Outbound Link: Click" (with the url as a property), which
// covers the app stores and the demo booking link. A link carrying one of the classes
// below reports under that name instead — the tracker suppresses the generic outbound
// event for tagged links, so each name counts once — and the url still rides along as
// a property.
//
// Each of these has a matching goal configured in Plausible. Renaming one here without
// renaming the goal there silently zeroes that number.

/** Any link into the app itself — "did they try it". */
export const OPEN_APP = 'plausible-event-name=Open+App';

/** Links to app.flotilla.social/spaces/create — "did they start a space". */
export const CREATE_SPACE = 'plausible-event-name=Create+Space';
