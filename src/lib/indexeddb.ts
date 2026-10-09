import {openDB, deleteDB} from "idb"
import type {IDBPDatabase} from "idb"
import {spec} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"

export type IDBStore = {
  name: string
  keyPath: string
}

export type IDBOptions = {
  name: string
  stores: IDBStore[]
}

export class IDB {
  connection: Maybe<Promise<Maybe<IDBPDatabase>>>
  failedToConnect = false
  private generation = 0

  constructor(readonly options: IDBOptions) {}

  // Object stores are only created during a version change, and which ones we need depends on the login.
  private open = async () => {
    const {name, stores} = this.options
    const blocking = () => this.close()
    const db = await openDB(name, undefined, {blocking})
    const missing = stores.filter(store => !db.objectStoreNames.contains(store.name))
    const obsolete = Array.from(db.objectStoreNames).filter(
      storeName => !stores.some(spec({name: storeName})),
    )

    if (missing.length === 0 && obsolete.length === 0) {
      return db
    }

    const version = db.version + 1

    db.close()

    return openDB(name, version, {
      upgrade(idbDb: IDBPDatabase) {
        for (const {name, keyPath} of missing) {
          idbDb.createObjectStore(name, {keyPath})
        }

        for (const storeName of obsolete) {
          idbDb.deleteObjectStore(storeName)
        }
      },
      blocked: (currentVersion, blockedVersion) =>
        console.error(
          `Upgrade of ${name} from ${currentVersion} to ${blockedVersion} is blocked by another connection`,
        ),
      blocking,
    })
  }

  /** A cache that cannot be opened, read or written degrades to no cache instead of stopping the app. */
  private fail = (error: unknown) => console.error(`Failed to access ${this.options.name}`, error)

  private attempt = async (f: () => Promise<void>) => {
    try {
      await f()
    } catch (e) {
      this.fail(e)
    }
  }

  async connect() {
    if (!this.failedToConnect && !this.connection) {
      this.connection = this.open().catch(e => {
        this.fail(e)

        this.failedToConnect = true

        return undefined
      })
    }

    return this.connection
  }

  // Deleting an account closes the database under writes that already awaited it.
  private live = async () => {
    const generation = this.generation
    const connection = await this.connect()

    return generation === this.generation ? connection : undefined
  }

  table = <T>(name: string) => new IDBTable<T>(this, name)

  /**
   * A getAll serializes the whole table into one structured clone. Chrome refuses a clone past a
   * cap that moves between versions, so every read walks a cursor instead.
   */
  each = <T>(table: string, visit: (item: T) => void) =>
    this.attempt(async () => {
      const connection = await this.live()

      if (connection) {
        const tx = connection.transaction(table, "readonly")
        let cursor = await tx.objectStore(table).openCursor()

        while (cursor) {
          visit(cursor.value)

          cursor = await cursor.continue()
        }

        await tx.done
      }
    })

  getAll = async <T>(table: string): Promise<T[]> => {
    const items: T[] = []

    await this.each<T>(table, item => items.push(item))

    return items
  }

  bulkPut = <T>(table: string, data: Iterable<T>) =>
    this.attempt(async () => {
      const connection = await this.live()

      if (connection) {
        const tx = connection.transaction(table, "readwrite")
        const store = tx.objectStore(table)

        for (const item of data) {
          try {
            store.put(item)
          } catch (e) {
            console.error(e, item)
          }
        }

        await tx.done
      }
    })

  bulkDelete = (table: string, ids: Iterable<string>) =>
    this.attempt(async () => {
      const connection = await this.live()

      if (connection) {
        const tx = connection.transaction(table, "readwrite")
        const store = tx.objectStore(table)

        await Promise.all(Array.from(ids).map(id => store.delete(id)))
        await tx.done
      }
    })

  close = async () => {
    const connection = this.connection

    this.connection = undefined
    this.generation += 1

    await connection?.then(c => c?.close())
  }

  clear = async () => {
    await this.close()
    await deleteDB(this.options.name, {
      blocked: currentVersion =>
        console.error(`Deletion of ${this.options.name} at ${currentVersion} is blocked`),
    })
  }
}

export class IDBTable<T> {
  constructor(
    readonly db: IDB,
    readonly name: string,
  ) {}

  each = (visit: (item: T) => void) => this.db.each<T>(this.name, visit)

  getAll = () => this.db.getAll<T>(this.name)

  bulkPut = (data: Iterable<T>) => this.db.bulkPut(this.name, data)

  bulkDelete = (ids: Iterable<string>) => this.db.bulkDelete(this.name, ids)
}
