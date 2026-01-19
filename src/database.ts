import { createPool, Pool, PoolOptions, RowDataPacket } from "mysql2/promise"
import { Database as DatabaseExtension } from "@hocuspocus/extension-database"

interface DocumentRow extends RowDataPacket {
  id: string
  data: Uint8Array
}

export default class Database {
  pool: Pool

  private getLogPrefix(): string {
    return `[rhine-var-hocuspocus-server ${new Date().toISOString()} database]`
  }

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
    console.log(`${this.getLogPrefix()} fetch called for document: "${documentName}"`)
    try {
      const [rows] = await this.pool.execute<DocumentRow[]>(
        'SELECT data FROM document WHERE id = ? LIMIT 1',
        [documentName]
      )
      if (rows.length === 0) {
        console.log(`${this.getLogPrefix()} Document "${documentName}" not found in database, returning null`)
        return null
      }
      console.log(`${this.getLogPrefix()} Document "${documentName}" fetched successfully, size: ${rows[0].data.length} bytes`)
      return rows[0].data
    } catch (error) {
      console.error(`${this.getLogPrefix()} Error fetching document "${documentName}" from MySQL:`, error)
      throw error
    }
  }

  async store({ documentName, state }: { documentName: string; state: Uint8Array }): Promise<void> {
    console.log(`${this.getLogPrefix()} store called for document: "${documentName}", size: ${state.length} bytes`)
    try {
      await this.pool.execute(
        'INSERT INTO document (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [documentName, state]
      )
    } catch (error) {
      console.error(`${this.getLogPrefix()} Error storing document "${documentName}" to MySQL:`, error)
      throw error
    }
  }

  getExtension() {
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