export type DialogContext = {
  registerLabel: (label: string) => () => void
  registerTitle: (id: string) => () => void
}

export const DIALOG_CONTEXT = Symbol("dialog")
