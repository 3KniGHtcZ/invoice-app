import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, FileText, Paperclip, LogOut, Sparkles, RefreshCw, Database, CheckCircle2, Cloud, Clock, AlertCircle, Play, GitBranch, GitCommit } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useEmails } from '@/hooks/useEmails'
import { useAttachments } from '@/hooks/useAttachments'
import { useJobStatus } from '@/hooks/useJobStatus'
import { useVersion } from '@/hooks/useVersion'

function App() {
  // Custom hooks
  const auth = useAuth()
  const emails = useEmails()
  const attachments = useAttachments()
  const jobStatus = useJobStatus()
  const versionInfo = useVersion()

  // Fetch emails and sync status when authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      emails.fetchEmails(attachments.fetchBatchAttachments)
      emails.fetchSyncStatus()
    }
  }, [auth.isAuthenticated])

  // Wrapper functions for hooks
  const handleLogout = async () => {
    await auth.logout()
    attachments.reset()
  }

  const handleSync = async () => {
    await emails.sync(() => emails.fetchEmails(attachments.fetchBatchAttachments))
  }

  // Combined error from all hooks
  const error = auth.error || emails.error || attachments.error

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Invoice Manager</h1>
          </div>
          {auth.isAuthenticated && (
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

        {/* Background Job Status Badge */}
        {auth.isAuthenticated && jobStatus.jobState && (
          <div className="mb-6 p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  {jobStatus.jobState.lastStatus === 'running' && (
                    <>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Running</span>
                    </>
                  )}
                  {jobStatus.jobState.lastStatus === 'success' && (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Success</span>
                    </>
                  )}
                  {jobStatus.jobState.lastStatus === 'error' && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Error</span>
                    </>
                  )}
                  {jobStatus.jobState.lastStatus === 'idle' && (
                    <>
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <span className="text-sm font-medium text-muted-foreground">Idle</span>
                    </>
                  )}
                </div>

                {/* Last Run Info */}
                {jobStatus.jobState.lastRunTimestamp && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Last check: {new Date(jobStatus.jobState.lastRunTimestamp).toLocaleString('cs-CZ')}
                    </span>
                  </div>
                )}

                {/* New Invoices Count */}
                {jobStatus.jobState.lastStatus === 'success' && jobStatus.jobState.newInvoicesCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {jobStatus.jobState.newInvoicesCount} new invoice{jobStatus.jobState.newInvoicesCount !== 1 ? 's' : ''} extracted
                    </span>
                  </div>
                )}

                {/* Error Message */}
                {jobStatus.jobState.lastStatus === 'error' && jobStatus.jobState.lastError && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {jobStatus.jobState.lastError}
                  </div>
                )}
              </div>

              {/* Manual Trigger Button */}
              <Button
                onClick={async () => {
                  try {
                    await jobStatus.triggerJob()
                    // Refresh email list after job completes
                    setTimeout(() => {
                      emails.fetchEmails(attachments.fetchBatchAttachments)
                    }, 2000)
                  } catch (err) {
                    console.error('Failed to trigger job:', err)
                  }
                }}
                disabled={jobStatus.jobState.lastStatus === 'running'}
                size="sm"
                variant="outline"
              >
                <Play className="w-4 h-4 mr-2" />
                {jobStatus.jobState.lastStatus === 'running' ? 'Running...' : 'Check Now'}
              </Button>
            </div>
          </div>
        )}

        {/* Login screen */}
        {!auth.isAuthenticated ? (
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
                onClick={auth.login}
                disabled={auth.loading}
                className="w-full"
                size="lg"
              >
                <Mail className="w-4 h-4 mr-2" />
                {auth.loading ? 'Connecting...' : 'Connect Outlook Account'}
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
                      <Button onClick={handleSync} disabled={emails.syncing} size="sm" variant="outline">
                        <Cloud className="w-4 h-4 mr-2" />
                        {emails.syncing ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button onClick={() => emails.fetchEmails(attachments.fetchBatchAttachments)} disabled={emails.loadingEmails} size="sm" variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {emails.loadingEmails ? 'Loading...' : 'Refresh'}
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {emails.emails.length} emails found
                    {emails.lastSyncTime && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        • Last sync: {new Date(emails.lastSyncTime).toLocaleString('cs-CZ')}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emails.loadingEmails ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading emails...
                    </div>
                  ) : emails.emails.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No emails found in "faktury" folder
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {emails.emails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => attachments.fetchAttachments(email.id, attachments.extractInvoiceData)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                            attachments.selectedEmail === email.id ? 'border-blue-500 bg-accent' : ''
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
                    {attachments.selectedEmail ? 'Select an attachment to view' : 'Select an email to view attachments'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!attachments.selectedEmail ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Select an email from the list
                    </div>
                  ) : attachments.attachments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No PDF attachments found
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {attachments.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          onClick={() => attachments.selectAttachment(attachment.id, attachments.selectedEmail!, attachments.extractInvoiceData)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                            attachments.selectedAttachment === attachment.id ? 'border-blue-500 bg-accent' : ''
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
                            {attachments.extractingAttachmentId === attachment.id && (
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
            {attachments.selectedEmail && attachments.selectedAttachment && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PDF Preview */}
                <Card className="h-[600px]">
                  <CardHeader>
                    <CardTitle>PDF Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[calc(100%-5rem)]">
                    <iframe
                      src={`/api/emails/${attachments.selectedEmail}/attachments/${attachments.selectedAttachment}`}
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
                        {attachments.invoiceData && (
                          <CardDescription className="flex items-center gap-2 mt-1">
                            {attachments.invoiceData.fromCache ? (
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
                      {attachments.invoiceData && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => attachments.extractInvoiceData(attachments.selectedEmail!, attachments.selectedAttachment!, true)}
                          disabled={attachments.extractingAttachmentId === attachments.selectedAttachment}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto">
                    {attachments.extractingAttachmentId === attachments.selectedAttachment ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-sm font-medium">Extracting invoice data...</p>
                        </div>
                      </div>
                    ) : attachments.invoiceData ? (
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Invoice Number</td>
                            <td className="py-3 px-4">{attachments.invoiceData.invoiceNumber || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Issue Date</td>
                            <td className="py-3 px-4">{attachments.invoiceData.issueDate || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Due Date</td>
                            <td className="py-3 px-4">{attachments.invoiceData.dueDate || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Supplier Name</td>
                            <td className="py-3 px-4">{attachments.invoiceData.supplierName || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Supplier IČO</td>
                            <td className="py-3 px-4">{attachments.invoiceData.supplierICO || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Supplier DIČ</td>
                            <td className="py-3 px-4">{attachments.invoiceData.supplierDIC || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Total Amount (incl. VAT)</td>
                            <td className="py-3 px-4">
                              {attachments.invoiceData.totalAmount !== null
                                ? `${attachments.invoiceData.totalAmount.toLocaleString()} ${attachments.invoiceData.currency || ''}`
                                : '-'}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Amount without VAT</td>
                            <td className="py-3 px-4">
                              {attachments.invoiceData.amountWithoutVAT !== null
                                ? `${attachments.invoiceData.amountWithoutVAT.toLocaleString()} ${attachments.invoiceData.currency || ''}`
                                : '-'}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">VAT Amount</td>
                            <td className="py-3 px-4">
                              {attachments.invoiceData.vatAmount !== null
                                ? `${attachments.invoiceData.vatAmount.toLocaleString()} ${attachments.invoiceData.currency || ''}`
                                : '-'}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Variable Symbol</td>
                            <td className="py-3 px-4">{attachments.invoiceData.variableSymbol || '-'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 px-4 font-semibold bg-muted/50">Currency</td>
                            <td className="py-3 px-4">{attachments.invoiceData.currency || '-'}</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-semibold bg-muted/50">Bank Account</td>
                            <td className="py-3 px-4">{attachments.invoiceData.bankAccount || '-'}</td>
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

        {/* Build Info Footer */}
        {versionInfo && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3 h-3" />
                <span>{versionInfo.version}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitCommit className="w-3 h-3" />
                <span title={versionInfo.gitCommit}>
                  {versionInfo.gitCommit.substring(0, 7)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>{new Date(versionInfo.buildDate).toLocaleString('cs-CZ')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
