export class AbortError extends Error {
  constructor() {
    super("Aborted")
    this.name = "AbortError"
  }
}

export class TimeoutError extends Error {
  constructor(message = "Timed out") {
    super(message)
    this.name = "TimeoutError"
  }
}
