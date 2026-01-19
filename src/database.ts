import { createPool, Pool, PoolOptions, RowDataPacket } from "mysql2/promise"
import { Database as DatabaseExtension } from "@hocuspocus/extension-database"
import * as Y from "yjs"

interface DocumentRow extends RowDataPacket {
  id: string
  data: Uint8Array
}

export default class Database {
  pool: Pool

  constructor(
    public type: string,
    public host: string,
    public port: number,
    public user: string,
    public password: string,
    public database: string,
  ) {
    const config: PoolOptions = {
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    }
    this.pool = createPool(config)

    config.password = '***'
    console.log('Create database pool with:', config)
  }

  async fetch({ documentName }: { documentName: string }): Promise<Uint8Array | null> {
    console.log(`[Database] fetch called for document: "${documentName}"`)
    try {
      const [rows] = await this.pool.execute<DocumentRow[]>(
        'SELECT data FROM document WHERE id = ? LIMIT 1',
        [documentName]
      )
      if (rows.length === 0) {
        console.log(`[Database] Document "${documentName}" not found in database, returning null`)
        return null
      }
      console.log(`[Database] Document "${documentName}" fetched successfully, size: ${rows[0].data.length} bytes`)
      return rows[0].data
    } catch (error) {
      console.error(`Error fetching document "${documentName}" from MySQL:`, error)
      throw error
    }
  }

  async store({ documentName, state }: { documentName: string; state: Uint8Array }): Promise<void> {
    console.log(`[Database] store called for document: "${documentName}", size: ${state.length} bytes`)
    try {
      await this.pool.execute(
        'INSERT INTO document (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [documentName, state]
      )
      console.log(`[Database] Document "${documentName}" stored successfully`)
    } catch (error) {
      console.error(`Error storing document "${documentName}" to MySQL:`, error)
      throw error
    }
  }

  getExtension() {
    console.log('[Database] Creating Database extension')
    return new DatabaseExtension({
      fetch: async ({ documentName }) => {
        return this.fetch({ documentName })
      },
      store: async ({ documentName, state }) => {
        return this.store({ documentName, state })
      },
    })
  }
}