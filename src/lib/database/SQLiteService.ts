import {CapacitorSQLite, SQLiteConnection, SQLiteDBConnection} from "@capacitor-community/sqlite"
import {Capacitor} from "@capacitor/core"

export interface ISQLiteService {
  openDatabase(
    dbName: string,
    loadToVersion: number,
    readOnly: boolean,
  ): Promise<SQLiteDBConnection>
  closeDatabase(dbName: string, readOnly: boolean): Promise<void>
  saveToStore(dbName: string): Promise<void>
  saveToLocalDisk(dbName: string): Promise<void>
  isConnection(dbName: string, readOnly: boolean): Promise<boolean>
}

export class SQLiteService implements ISQLiteService {
  platform = Capacitor.getPlatform()
  sqlitePlugin = CapacitorSQLite
  sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  dbNameVersionDict: Map<string, number> = new Map()

  async openDatabase(
    dbName: string,
    loadToVersion: number,
    readOnly: boolean,
  ): Promise<SQLiteDBConnection> {
    this.dbNameVersionDict.set(dbName, loadToVersion)
    const encrypted = false
    const mode = encrypted ? "secret" : "no-encryption"

    try {
      let db: SQLiteDBConnection
      const retCC = (await this.sqliteConnection.checkConnectionsConsistency()).result
      const isConn = (await this.sqliteConnection.isConnection(dbName, readOnly)).result

      if (retCC && isConn) {
        db = await this.sqliteConnection.retrieveConnection(dbName, readOnly)
      } else {
        db = await this.sqliteConnection.createConnection(
          dbName,
          encrypted,
          mode,
          loadToVersion,
          readOnly,
        )
      }

      await db.open()
      const res = (await db.isDBOpen()).result!

      if (!res) {
        throw new Error(`sqliteService.openDatabase: db ${dbName} not opened`)
      }

      return db
    } catch (err: any) {
      throw new Error(`sqliteService.openDatabase: ${err.message || err}`)
    }
  }

  async isConnection(dbName: string, readOnly: boolean): Promise<boolean> {
    try {
      const isConn = (await this.sqliteConnection.isConnection(dbName, readOnly)).result
      if (isConn != undefined) {
        return isConn
      } else {
        throw new Error(`sqliteService.isConnection undefined`)
      }
    } catch (err: any) {
      throw new Error(`sqliteService.isConnection: ${err.message || err}`)
    }
  }

  async closeDatabase(dbName: string, readOnly: boolean): Promise<void> {
    try {
      const isConn = (await this.sqliteConnection.isConnection(dbName, readOnly)).result
      if (isConn) {
        await this.sqliteConnection.closeConnection(dbName, readOnly)
      }
    } catch (err: any) {
      throw new Error(`sqliteService.closeDatabase: ${err.message || err}`)
    }
  }

  async saveToStore(dbName: string): Promise<void> {
    if (this.platform !== "web") {
      throw new Error(`sqliteService.saveToStore: Not supported on ${this.platform}`)
    }

    try {
      await this.sqliteConnection.saveToStore(dbName)
    } catch (err: any) {
      throw new Error(`sqliteService.saveToStore: ${err.message || err}`)
    }
  }

  async saveToLocalDisk(dbName: string): Promise<void> {
    try {
      await this.sqliteConnection.saveToLocalDisk(dbName)
    } catch (err: any) {
      throw new Error(`sqliteService.saveToLocalDisk: ${err.message || err}`)
    }
  }
}

export const sqliteService = new SQLiteService()
