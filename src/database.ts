import { createPool, Pool, PoolOptions, RowDataPacket } from "mysql2/promise"
import { fetchPayload, storePayload } from "@hocuspocus/server"
import { Database as DatabaseExtension } from "@hocuspocus/extension-database"

interface DocumentRow extends RowDataPacket {
  id: string
  data: Uint8Array<ArrayBufferLike>
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

  async fetch({ documentName }: fetchPayload): Promise<Uint8Array<ArrayBufferLike> | null> {
    try {
      const [rows] = await this.pool.execute<DocumentRow[]>(
        'SELECT data FROM documents WHERE id = ? LIMIT 1',
        [documentName]
      )
      if (rows.length === 0) {
        return null
      }
      return rows[0].data
    } catch (error) {
      console.error(`Error fetching document "${documentName}" from MySQL:`, error)
      throw error
    }
  }

  async store({ documentName, state }: storePayload): Promise<void> {
    try {
      await this.pool.execute(
        'INSERT INTO documents (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [documentName, state]
      )
    } catch (error) {
      console.error(`Error storing document "${documentName}" to MySQL:`, error)
      throw error
    }
  }

  getExtension() {
    return new DatabaseExtension({
      fetch: payload => this.fetch(payload),
      store: payload => this.store(payload),
    })
  }
}