import Database from 'better-sqlite3'
import path from 'path'
import { InvoiceData } from './invoiceExtractionService'

interface InvoiceRecord extends InvoiceData {
  id: number
  messageId: string
  attachmentId: string
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  userId: string
  accessToken: string
  refreshToken: string | null
  expiresAt: string
}

class DatabaseService {
  private db: Database.Database

  constructor() {
    // Use /app/data in production (Docker), process.cwd() in development
    const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd()
    const dbPath = path.join(dataDir, 'invoices.db')
    console.log(`Using database path: ${dbPath}`)
    this.db = new Database(dbPath)
    this.initialize()
  }

  private initialize() {
    // Create invoices table if it doesn't exist
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        attachment_id TEXT NOT NULL,
        invoice_number TEXT,
        issue_date TEXT,
        due_date TEXT,
        supplier_name TEXT,
        supplier_ico TEXT,
        supplier_dic TEXT,
        total_amount REAL,
        amount_without_vat REAL,
        vat_amount REAL,
        variable_symbol TEXT,
        currency TEXT,
        bank_account TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, attachment_id)
      )
    `).run()

    // Create index for faster lookups
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_message_attachment
      ON invoices(message_id, attachment_id)
    `).run()

    // Create sync metadata table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync_timestamp TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    // Create auth tokens table (single user mode)
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at DATETIME NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    // Migrate existing databases: make refresh_token nullable if it exists
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS auth_tokens_new (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          user_id TEXT NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at DATETIME NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()

      // Check if we need to migrate
      const tableInfo = this.db.prepare("PRAGMA table_info(auth_tokens)").all() as any[]
      const refreshTokenColumn = tableInfo.find(col => col.name === 'refresh_token')

      if (refreshTokenColumn && refreshTokenColumn.notnull === 1) {
        // Migration needed
        this.db.prepare(`
          INSERT INTO auth_tokens_new (id, user_id, access_token, refresh_token, expires_at, updated_at)
          SELECT id, user_id, access_token, refresh_token, expires_at, updated_at FROM auth_tokens
        `).run()
        this.db.prepare('DROP TABLE auth_tokens').run()
        this.db.prepare('ALTER TABLE auth_tokens_new RENAME TO auth_tokens').run()
      } else {
        // No migration needed, drop temp table
        this.db.prepare('DROP TABLE IF NOT EXISTS auth_tokens_new').run()
      }
    } catch (err) {
      // Migration already done or error - continue
      console.log('Auth tokens table migration check:', err)
    }
  }

  getInvoiceData(messageId: string, attachmentId: string): InvoiceData | null {
    const stmt = this.db.prepare(`
      SELECT
        invoice_number as invoiceNumber,
        issue_date as issueDate,
        due_date as dueDate,
        supplier_name as supplierName,
        supplier_ico as supplierICO,
        supplier_dic as supplierDIC,
        total_amount as totalAmount,
        amount_without_vat as amountWithoutVAT,
        vat_amount as vatAmount,
        variable_symbol as variableSymbol,
        currency,
        bank_account as bankAccount
      FROM invoices
      WHERE message_id = ? AND attachment_id = ?
    `)

    const result = stmt.get(messageId, attachmentId) as InvoiceData | undefined
    return result || null
  }

  saveInvoiceData(
    messageId: string,
    attachmentId: string,
    data: InvoiceData
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO invoices (
        message_id,
        attachment_id,
        invoice_number,
        issue_date,
        due_date,
        supplier_name,
        supplier_ico,
        supplier_dic,
        total_amount,
        amount_without_vat,
        vat_amount,
        variable_symbol,
        currency,
        bank_account,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    stmt.run(
      messageId,
      attachmentId,
      data.invoiceNumber,
      data.issueDate,
      data.dueDate,
      data.supplierName,
      data.supplierICO,
      data.supplierDIC,
      data.totalAmount,
      data.amountWithoutVAT,
      data.vatAmount,
      data.variableSymbol,
      data.currency,
      data.bankAccount
    )
  }

  deleteInvoiceData(messageId: string, attachmentId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM invoices
      WHERE message_id = ? AND attachment_id = ?
    `)
    stmt.run(messageId, attachmentId)
  }

  hasExtractedData(messageId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE message_id = ?
    `)
    const result = stmt.get(messageId) as { count: number }
    return result.count > 0
  }

  updateSyncTimestamp(timestamp: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (id, last_sync_timestamp, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `)
    stmt.run(timestamp)
  }

  getLastSyncTimestamp(): string | null {
    const stmt = this.db.prepare(`
      SELECT last_sync_timestamp
      FROM sync_metadata
      WHERE id = 1
    `)
    const result = stmt.get() as { last_sync_timestamp: string } | undefined
    return result?.last_sync_timestamp || null
  }

  // Auth token management methods
  saveAuthTokens(tokens: AuthTokens): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO auth_tokens (
        id,
        user_id,
        access_token,
        refresh_token,
        expires_at,
        updated_at
      ) VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    stmt.run(
      tokens.userId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt
    )
  }

  getAuthTokens(): AuthTokens | null {
    const stmt = this.db.prepare(`
      SELECT
        user_id as userId,
        access_token as accessToken,
        refresh_token as refreshToken,
        expires_at as expiresAt
      FROM auth_tokens
      WHERE id = 1
    `)
    const result = stmt.get() as AuthTokens | undefined
    return result || null
  }

  clearAuthTokens(): void {
    const stmt = this.db.prepare(`
      DELETE FROM auth_tokens WHERE id = 1
    `)
    stmt.run()
  }

  close() {
    this.db.close()
  }
}

export const databaseService = new DatabaseService()
