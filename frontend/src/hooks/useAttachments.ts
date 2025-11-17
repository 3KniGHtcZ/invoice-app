import { useState } from 'react'

export interface EmailAttachment {
  id: string
  name: string
  contentType: string
  size: number
}

export interface InvoiceData {
  invoiceNumber: string | null
  issueDate: string | null
  dueDate: string | null
  supplierName: string | null
  supplierICO: string | null
  supplierDIC: string | null
  totalAmount: number | null
  amountWithoutVAT: number | null
  vatAmount: number | null
  variableSymbol: string | null
  currency: string | null
  bankAccount: string | null
  fromCache?: boolean
}

export function useAttachments() {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<EmailAttachment[]>([])
  const [allAttachments, setAllAttachments] = useState<Record<string, EmailAttachment[]>>({})
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [extractingAttachmentId, setExtractingAttachmentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchBatchAttachments = async (messageIds: string[]) => {
    try {
      const response = await fetch('/api/emails/attachments/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      })
      if (!response.ok) {
        throw new Error('Failed to batch fetch attachments')
      }
      const batchData = await response.json()
      setAllAttachments(batchData)
    } catch (err) {
      console.error('Error batch fetching attachments:', err)
      // Don't set error - attachments will be fetched individually on demand
    }
  }

  const fetchAttachments = async (messageId: string, onExtract?: (messageId: string, attachmentId: string) => void) => {
    // Try to use cached batch data first
    if (allAttachments[messageId]) {
      const data = allAttachments[messageId]
      setAttachments(data)
      setSelectedEmail(messageId)

      // Automatically select and extract first attachment
      if (data.length > 0 && onExtract) {
        const firstAttachment = data[0]
        setSelectedAttachment(firstAttachment.id)
        // Auto-extract for first attachment
        onExtract(messageId, firstAttachment.id)
      }
      return
    }

    // Fallback to individual fetch if not in cache
    try {
      const response = await fetch(`/api/emails/${messageId}/attachments`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch attachments')
      }
      const data = await response.json()
      setAttachments(data)
      setSelectedEmail(messageId)

      // Cache the result
      setAllAttachments((prev) => ({ ...prev, [messageId]: data }))

      // Automatically select and extract first attachment
      if (data.length > 0 && onExtract) {
        const firstAttachment = data[0]
        setSelectedAttachment(firstAttachment.id)
        // Auto-extract for first attachment
        onExtract(messageId, firstAttachment.id)
      }
    } catch (err) {
      console.error('Error fetching attachments:', err)
      setError('Failed to fetch attachments')
    }
  }

  const selectAttachment = (attachmentId: string, messageId: string, onExtract?: (messageId: string, attachmentId: string) => void) => {
    setSelectedAttachment(attachmentId)
    if (onExtract) {
      onExtract(messageId, attachmentId)
    }
  }

  const extractInvoiceData = async (messageId: string, attachmentId: string, regenerate = false) => {
    setExtractingAttachmentId(attachmentId)
    setError(null)
    try {
      const url = `/api/emails/${messageId}/attachments/${attachmentId}/extract${regenerate ? '?regenerate=true' : ''}`
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to extract invoice data')
      }
      const data = await response.json()
      setInvoiceData(data)
    } catch (err) {
      console.error('Error extracting invoice data:', err)
      setError('Failed to extract invoice data from PDF')
    } finally {
      setExtractingAttachmentId(null)
    }
  }

  const reset = () => {
    setSelectedEmail(null)
    setAttachments([])
    setSelectedAttachment(null)
    setInvoiceData(null)
  }

  return {
    selectedEmail,
    attachments,
    allAttachments,
    selectedAttachment,
    invoiceData,
    extractingAttachmentId,
    error,
    fetchBatchAttachments,
    fetchAttachments,
    selectAttachment,
    extractInvoiceData,
    reset,
    setError,
  }
}
