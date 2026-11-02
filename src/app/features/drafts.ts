const store = new Map<string, unknown>()

export type Draft = {
  content?: string | object
}

export class DraftKey<T> {
  constructor(readonly key: string) {}

  get(): T | undefined {
    return store.get(this.key) as T | undefined
  }

  set(value: T): void {
    store.set(this.key, value)
  }

  update(value: Partial<T>): void {
    this.set({...this.get(), ...value} as T)
  }

  clear(): void {
    store.delete(this.key)
  }
}
