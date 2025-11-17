import { useState } from 'react'

export interface EmailMessage {
  id: string
  subject: string
  from: string
  receivedDateTime: string
  hasAttachments: boolean
  hasExtractedData?: boolean
}

export function useEmails() {
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchEmails = async (onBatchFetch?: (messageIds: string[]) => void) => {
    setLoadingEmails(true)
    setError(null)
    try {
      const response = await fetch('/api/emails/faktury', {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch emails')
      }
      const data = await response.json()
      setEmails(data)

      // Batch fetch attachments for all emails with attachments (fixes N+1 query)
      const emailsWithAttachments = data.filter((email: EmailMessage) => email.hasAttachments)
      if (emailsWithAttachments.length > 0 && onBatchFetch) {
        onBatchFetch(emailsWithAttachments.map((e: EmailMessage) => e.id))
      }
    } catch (err) {
      console.error('Error fetching emails:', err)
      setError('Failed to fetch emails from faktury folder')
    } finally {
      setLoadingEmails(false)
    }
  }

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/emails/sync/status', {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch sync status')
      }
      const data = await response.json()
      setLastSyncTime(data.lastSyncTimestamp)
    } catch (err) {
      console.error('Error fetching sync status:', err)
    }
  }

  const sync = async (onComplete?: () => void) => {
    setSyncing(true)
    setError(null)
    try {
      const response = await fetch('/api/emails/sync', {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to sync emails')
      }
      const result = await response.json()
      setLastSyncTime(result.timestamp)

      // Refresh emails after sync
      if (onComplete) {
        await onComplete()
      }

      if (result.newInvoices > 0) {
        console.log(`Sync completed: ${result.newInvoices} new invoices found`)
      }
    } catch (err) {
      console.error('Error syncing emails:', err)
      setError('Failed to sync emails')
    } finally {
      setSyncing(false)
    }
  }

  return {
    emails,
    loadingEmails,
    error,
    lastSyncTime,
    syncing,
    fetchEmails,
    fetchSyncStatus,
    sync,
    setError,
  }
}
