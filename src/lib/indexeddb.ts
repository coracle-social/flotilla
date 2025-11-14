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

export type IDBOptions = {
  name: string
  version: number
}

export class IDB {
  adapters: IDBAdapters = []
  connection: Maybe<Promise<IDBPDatabase>>
  unsubscribers: Maybe<Unsubscriber[]>

  constructor(readonly options: IDBOptions) {}

  async connect() {
    if (!this.connection) {
      const {name, version} = this.options
      const adapters = this.adapters

      this.connection = openDB(name, version, {
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

      this.unsubscribers = await Promise.all(adapters.map(({name, init}) => init(this.table(name))))
    }

    return this.connection
  }

  table = <T>(name: string) => new IDBTable<T>(this, name)

  getAll = async <T>(table: string): Promise<T[]> => {
    const connection = await this.connect()
    const tx = connection.transaction(table, "readwrite")
    const store = tx.objectStore(table)
    const result = await store.getAll()

    await tx.done

    return result || []
  }

  bulkPut = async <T>(table: string, data: Iterable<T>) => {
    const connection = await this.connect()
    const tx = connection.transaction(table, "readwrite")
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
  }

  bulkDelete = async (table: string, ids: Iterable<string>) => {
    const connection = await this.connect()
    const tx = connection.transaction(table, "readwrite")
    const store = tx.objectStore(table)

    await Promise.all(Array.from(ids).map(id => store.delete(id)))
    await tx.done
  }

  close = () => {
    this.unsubscribers?.forEach(call)
    this.unsubscribers = undefined

    this.connection?.then(c => c.close())
    this.connection = undefined
  }

  clear = async () => {
    await this.connection?.then(c => c.close())
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
