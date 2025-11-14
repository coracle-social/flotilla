import {openDB, deleteDB} from "idb"
import type {IDBPDatabase} from "idb"
import type {Unsubscriber} from "svelte/store"
import {call} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"

export type IDBAdapter = {
  name: string
  keyPath: string
  init: (table: IDBTable<any>) => Promise<Unsubscriber>
}

export type IDBAdapters = IDBAdapter[]

export enum IDBStatus {
  Ready = "ready",
  Closed = "closed",
  Opening = "opening",
  Closing = "closing",
  Initial = "initial",
}

export type IDBOptions = {
  name: string
  version: number
}

export class IDB {
  idbp: Maybe<Promise<IDBPDatabase>>
  unsubscribers: Maybe<Unsubscriber[]>
  status = IDBStatus.Initial

  constructor(readonly options: IDBOptions) {}

  async init(adapters: IDBAdapters) {
    if (this.idbp) {
      throw new Error("Unable to initialize a database that isn't yet closed")
    }

    this.status = IDBStatus.Opening

    this.idbp = openDB(this.options.name, this.options.version, {
      upgrade(idbDb: IDBPDatabase) {
        const names = new Set(adapters.map(a => a.name))

        for (const table of idbDb.objectStoreNames) {
          if (!names.has(table)) {
            idbDb.deleteObjectStore(table)
          }
        }

        for (const {name, keyPath} of adapters) {
          try {
            idbDb.createObjectStore(name, {keyPath})
          } catch (e) {
            console.warn(e)
          }
        }
      },
      blocked() {},
      blocking() {},
    })

    return this.idbp.then(async idbp => {
      window.addEventListener("beforeunload", () => idbp.close())

      this.unsubscribers = await Promise.all(adapters.map(({name, init}) => init(this.table(name))))

      this.status = IDBStatus.Ready
    })
  }

  table = <T>(name: string) => new IDBTable<T>(this, name)

  _withIDBP = async <T>(f: (db: IDBPDatabase) => Promise<T>) => {
    if (this.status === IDBStatus.Initial) {
      throw new Error("Database was accessed in initial state")
    }

    // If we're closing, ignore any lingering requests
    if ([IDBStatus.Closed, IDBStatus.Closing].includes(this.status)) return

    return f(await this.idbp!)
  }

  getAll = async <T>(table: string): Promise<T[]> => {
    const result = await this._withIDBP(async idbp => {
      const tx = idbp.transaction(table, "readwrite")
      const store = tx.objectStore(table)
      const result = await store.getAll()

      await tx.done

      return result
    })

    return result || []
  }

  bulkPut = async <T>(table: string, data: Iterable<T>) =>
    this._withIDBP(async idbp => {
      const tx = idbp.transaction(table, "readwrite")
      const store = tx.objectStore(table)

      await Promise.all(
        Array.from(data).map(item => {
          try {
            store.put(item)
          } catch (e) {
            console.error(e, item)
          }
        }),
      )

      await tx.done
    })

  bulkDelete = async (table: string, ids: Iterable<string>) =>
    this._withIDBP(async idbp => {
      const tx = idbp.transaction(table, "readwrite")
      const store = tx.objectStore(table)

      await Promise.all(Array.from(ids).map(id => store.delete(id)))
      await tx.done
    })

  close = () =>
    this._withIDBP(async idbp => {
      this.unsubscribers!.forEach(call)
      this.status = IDBStatus.Closing

      await idbp.close()

      this.idbp = undefined
      this.unsubscribers = undefined
      this.status = IDBStatus.Closed
    })

  clear = async () => {
    await this.close()
    await deleteDB(this.options.name, {
      blocked() {},
    })
  }
}

export class IDBTable<T> {
  constructor(
    readonly db: IDB,
    readonly name: string,
  ) {}

  getAll = () => this.db.getAll<T>(this.name)

  bulkPut = (data: Iterable<T>) => this.db.bulkPut(this.name, data)

  bulkDelete = (ids: Iterable<string>) => this.db.bulkDelete(this.name, ids)
}
