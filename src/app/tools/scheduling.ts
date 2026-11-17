// Scheduling a post: for a space the post is dated ahead of now, which the space
// relay holds until its time; for an outbox post it goes to the scheduler relay,
// which forwards to the user's relays when due.

// A space relay that keeps future-dated events turns a schedule into a promise the
// relay itself keeps. One that refuses the event leaves nothing queued, so the
// user shouldn't be told it was scheduled.
export const SCHEDULE_UNSUPPORTED = "This space doesn't support scheduling posts at a later time."

export class ScheduleError extends Error {}
