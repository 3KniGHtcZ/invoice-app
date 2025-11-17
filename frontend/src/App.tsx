import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, FileText, Paperclip, LogOut, Sparkles, RefreshCw, Database, CheckCircle2, Cloud } from 'lucide-react'

interface EmailMessage {
  id: string
  subject: string
  from: string
  receivedDateTime: string
  hasAttachments: boolean
  hasExtractedData?: boolean
}

interface EmailAttachment {
  id: string
  name: string
  contentType: string
  size: number
}

interface InvoiceData {
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<EmailAttachment[]>([])
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null)
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [extractingAttachmentId, setExtractingAttachmentId] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    checkAuthStatus()

    // Listen for OAuth callback from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'AUTH_SUCCESS') {
        console.log('Authentication successful!')
        checkAuthStatus()
      } else if (event.data.type === 'AUTH_ERROR') {
        setError('Authentication failed. Please try again.')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails()
      fetchSyncStatus()
    }
  }, [isAuthenticated])

  const checkAuthStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include',
      })
      const data = await response.json()
      setIsAuthenticated(data.isAuthenticated)
    } catch (err) {
      console.error('Error checking auth status:', err)
      setError('Failed to check authentication status')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setError(null)
    setLoading(true)

    try {
      // Get auth URL from backend
      const response = await fetch('/api/auth/login')
      const data = await response.json()

      if (data.authUrl) {
        // Open popup window for OAuth
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        window.open(
          data.authUrl,
          'Microsoft Login',
          `width=${width},height=${height},left=${left},top=${top}`
        )
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to initiate login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setIsAuthenticated(false)
      setEmails([])
      setSelectedEmail(null)
      setAttachments([])
      setSelectedAttachment(null)
      setInvoiceData(null)
    } catch (err) {
      console.error('Logout error:', err)
      setError('Failed to log out')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmails = async () => {
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
    } catch (err) {
      console.error('Error fetching emails:', err)
      setError('Failed to fetch emails from faktury folder')
    } finally {
      setLoadingEmails(false)
    }
  }

  const fetchAttachments = async (messageId: string) => {
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

      // Automatically select and extract first attachment
      if (data.length > 0) {
        const firstAttachment = data[0]
        setSelectedAttachment(firstAttachment.id)
        // Auto-extract for first attachment
        extractInvoiceData(messageId, firstAttachment.id)
      }
    } catch (err) {
      console.error('Error fetching attachments:', err)
      setError('Failed to fetch attachments')
    }
  }

  const selectAttachment = (attachmentId: string) => {
    setSelectedAttachment(attachmentId)
    if (selectedEmail) {
      extractInvoiceData(selectedEmail, attachmentId)
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

  const handleSync = async () => {
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
      await fetchEmails()

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Invoice Manager</h1>
          </div>
          {isAuthenticated && (
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Login screen */}
        {!isAuthenticated ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Mail className="w-6 h-6" />
                Connect to Outlook
              </CardTitle>
              <CardDescription>
                Sign in to access your invoice emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                <Mail className="w-4 h-4 mr-2" />
                {loading ? 'Connecting...' : 'Connect Outlook Account'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Top Section: Emails and Attachments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email list */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Invoices from "faktury" folder</CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={handleSync} disabled={syncing} size="sm" variant="outline">
                        <Cloud className="w-4 h-4 mr-2" />
                        {syncing ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button onClick={fetchEmails} disabled={loadingEmails} size="sm" variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {loadingEmails ? 'Loading...' : 'Refresh'}
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {emails.length} emails found
                    {lastSyncTime && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        • Last sync: {new Date(lastSyncTime).toLocaleString('cs-CZ')}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingEmails ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading emails...
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No emails found in "faktury" folder
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {emails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => fetchAttachments(email.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                            selectedEmail === email.id ? 'border-blue-500 bg-accent' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{email.subject}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                From: {email.from}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(email.receivedDateTime).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {email.hasExtractedData && (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              )}
                              {email.hasAttachments && (
                                <Paperclip className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments panel */}
              <Card>
                <CardHeader>
                  <CardTitle>PDF Attachments</CardTitle>
                  <CardDescription>
                    {selectedEmail ? 'Select an attachment to view' : 'Select an email to view attachments'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedEmail ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Select an email from the list
                    </div>
                  ) : attachments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No PDF attachments found
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          onClick={() => selectAttachment(attachment.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                            selectedAttachment === attachment.id ? 'border-blue-500 bg-accent' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-red-600" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{attachment.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(attachment.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            {extractingAttachmentId === attachment.id && (
                              <div className="text-blue-600 text-sm">Extracting...</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bottom Section: PDF Preview and Extracted Data */}
            {selectedEmail && selectedAttachment && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PDF Preview */}
                <Card className="h-[600px]">
                  <CardHeader>
                    <CardTitle>PDF Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[calc(100%-5rem)]">
                    <iframe
                      src={`/api/emails/${selectedEmail}/attachments/${selectedAttachment}`}
                      className="w-full h-full border rounded"
                      title="PDF Preview"
                    />
                  </CardContent>
                </Card>

                {/* Extracted Data */}
                <Card className="h-[600px] flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Extracted Invoice Data</CardTitle>
                        {invoiceData && (
                          <CardDescription className="flex items-center gap-2 mt-1">
                            {invoiceData.fromCache ? (
                              <>
                                <Database className="w-4 h-4 text-green-600" />
                                <span>Loaded from database (cached)</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-blue-600" />
                                <span>Freshly extracted with AI</span>
                              </>
                            )}
                          </CardDescription>
                        )}
                      </div>
                      {invoiceData && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extractInvoiceData(selectedEmail, selectedAttachment, true)}
                          disabled={extractingAttachmentId === selectedAttachment}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto">
                    {extractingAttachmentId === selectedAttachment ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-sm font-medium">Extracting invoice data...</p>
                        </div>
                      </div>
                    ) : invoiceData ? (
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Invoice Number</td>
                            <td className="py-3 px-4">{invoiceData.invoiceNumber || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Issue Date</td>
                            <td className="py-3 px-4">{invoiceData.issueDate || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Due Date</td>
                            <td className="py-3 px-4">{invoiceData.dueDate || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Supplier Name</td>
                            <td className="py-3 px-4">{invoiceData.supplierName || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Supplier IČO</td>
                            <td className="py-3 px-4">{invoiceData.supplierICO || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Supplier DIČ</td>
                            <td className="py-3 px-4">{invoiceData.supplierDIC || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Total Amount (incl. VAT)</td>
                            <td className="py-3 px-4">
                              {invoiceData.totalAmount !== null
                                ? `${invoiceData.totalAmount.toLocaleString()} ${invoiceData.currency || ''}`
                                : '-'}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Amount without VAT</td>
                            <td className="py-3 px-4">
                              {invoiceData.amountWithoutVAT !== null
                                ? `${invoiceData.amountWithoutVAT.toLocaleString()} ${invoiceData.currency || ''}`
                                : '-'}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">VAT Amount</td>
                            <td className="py-3 px-4">
                              {invoiceData.vatAmount !== null
                                ? `${invoiceData.vatAmount.toLocaleString()} ${invoiceData.currency || ''}`
                                : '-'}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Variable Symbol</td>
                            <td className="py-3 px-4">{invoiceData.variableSymbol || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Currency</td>
                            <td className="py-3 px-4">{invoiceData.currency || '-'}</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-semibold bg-muted/50">Bank Account</td>
                            <td className="py-3 px-4">{invoiceData.bankAccount || '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Select an attachment to extract data
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
