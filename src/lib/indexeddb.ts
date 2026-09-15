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

  // Object stores can only be created during a version change, and which stores we need depends
  // on who is logged in, so open at whatever version exists and bump it to reconcile the schema.
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

  async connect() {
    if (!this.failedToConnect && !this.connection) {
      this.connection = this.open().catch(e => {
        console.error("Failed to connect to indexeddb", e)

        this.failedToConnect = true

        return undefined
      })
    }

    return this.connection
  }

  // Deleting an account closes the database out from under writes that already awaited it, and
  // the transaction they go on to open throws where nobody is catching. What they were going to
  // read or write is gone with the connection, so hand them nothing instead.
  private live = async () => {
    const generation = this.generation
    const connection = await this.connect()

    return generation === this.generation ? connection : undefined
  }

  table = <T>(name: string) => new IDBTable<T>(this, name)

  getAll = async <T>(table: string): Promise<T[]> => {
    const connection = await this.live()

    if (!connection) return []

    const tx = connection.transaction(table, "readonly")
    const store = tx.objectStore(table)
    const result = await store.getAll()

    await tx.done

    return result || []
  }

  bulkPut = async <T>(table: string, data: Iterable<T>) => {
    const connection = await this.live()

    if (!connection) return

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
    const connection = await this.live()

    if (!connection) return

    const tx = connection.transaction(table, "readwrite")
    const store = tx.objectStore(table)

    await Promise.all(Array.from(ids).map(id => store.delete(id)))
    await tx.done
  }

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

  getAll = () => this.db.getAll<T>(this.name)

  bulkPut = (data: Iterable<T>) => this.db.bulkPut(this.name, data)

  bulkDelete = (ids: Iterable<string>) => this.db.bulkDelete(this.name, ids)
}
