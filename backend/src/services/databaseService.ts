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

class DatabaseService {
  private db: Database.Database

  constructor() {
    const dbPath = path.join(process.cwd(), 'invoices.db')
    this.db = new Database(dbPath)
    this.initialize()
  }

  private initialize() {
    // Create invoices table if it doesn't exist
    this.db.exec(`
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
    `)

    // Create index for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_message_attachment
      ON invoices(message_id, attachment_id)
    `)

    // Create sync metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync_timestamp TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
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

  close() {
    this.db.close()
  }
}

export const databaseService = new DatabaseService()
