import cron, { type ScheduledTask } from 'node-cron'
import { syncService } from './syncService.js'
import { tokenManagerService } from './tokenManagerService.js'
import { databaseService } from './databaseService.js'

class BackgroundJobService {
  private cronJob: ScheduledTask | null = null
  private isRunning = false
  private cronSchedule = process.env.BACKGROUND_JOB_CRON || '*/5 * * * *' // Default: every 5 minutes
  private maxRetries = 3
  private retryDelayMs = 5000 // 5 seconds

  /**
   * Start the background job scheduler
   */
  start() {
    if (this.cronJob) {
      console.log('Background job is already running')
      return
    }

    console.log(`Starting background job with schedule: ${this.cronSchedule}`)
    this.cronJob = cron.schedule(this.cronSchedule, async () => {
      await this.checkEmailsWithRetry()
    })

    console.log('Background email check job started')
  }

  /**
   * Stop the background job scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
      console.log('Background job stopped')
    }
  }

  /**
   * Main job function with retry logic
   */
  private async checkEmailsWithRetry(attempt: number = 0): Promise<void> {
    try {
      await this.checkEmails()
      // Reset consecutive errors on success
      const currentState = databaseService.getJobState()
      if (currentState && currentState.consecutiveErrors > 0) {
        databaseService.updateJobState({ consecutiveErrors: 0 })
      }
    } catch (error) {
      console.error(`Error in background job (attempt ${attempt + 1}/${this.maxRetries}):`, error)

      if (attempt < this.maxRetries - 1) {
        // Retry with exponential backoff
        const delay = this.retryDelayMs * Math.pow(2, attempt)
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.checkEmailsWithRetry(attempt + 1)
      }

      // Max retries reached
      const currentState = databaseService.getJobState()
      const consecutiveErrors = (currentState?.consecutiveErrors || 0) + 1
      databaseService.updateJobState({
        lastStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        consecutiveErrors,
        lastRunTimestamp: new Date().toISOString()
      })

      // If too many consecutive errors, stop the job
      if (consecutiveErrors >= 5) {
        console.error('Too many consecutive errors (5), stopping background job')
        this.stop()
      }
    }
  }

  /**
   * Check emails and extract invoices
   */
  async checkEmails(): Promise<void> {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log('Job already running, skipping this execution')
      return
    }

    this.isRunning = true
    const startTime = new Date()
    const startTimestamp = startTime.toISOString()

    // Update state to running
    databaseService.updateJobState({
      lastStatus: 'running',
      lastRunTimestamp: startTimestamp,
      lastError: null
    })

    // Create execution history record
    const executionId = Date.now()

    try {
      console.log('Background job: Checking emails...')

      // Get valid access token (auto-refresh if needed)
      const accessToken = await tokenManagerService.getValidAccessToken()

      if (!accessToken) {
        throw new Error('No valid access token available. User needs to re-authenticate.')
      }

      // Sync emails with auto-extraction enabled
      const result = await syncService.syncEmails(accessToken, true)

      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      console.log(`Background job completed: ${result.newEmails} new emails, ${result.newInvoices} invoices extracted`)

      // Calculate next scheduled run (approximation)
      const nextRun = new Date(endTime.getTime() + 5 * 60 * 1000) // +5 minutes

      // Update job state
      databaseService.updateJobState({
        lastStatus: 'success',
        lastRunTimestamp: endTime.toISOString(),
        lastRunDurationMs: duration,
        lastError: null,
        newInvoicesCount: result.newInvoices,
        totalInvoicesCount: result.totalInvoices,
        nextScheduledRun: nextRun.toISOString()
      })

      // Add execution to history
      databaseService.addJobExecution({
        jobName: 'email_check',
        startedAt: startTimestamp,
        completedAt: endTime.toISOString(),
        status: 'success',
        error: null,
        newInvoicesCount: result.newInvoices,
        totalInvoicesCount: result.totalInvoices,
        durationMs: duration
      })
    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error('Background job failed:', errorMessage)

      // Add failed execution to history
      databaseService.addJobExecution({
        jobName: 'email_check',
        startedAt: startTimestamp,
        completedAt: endTime.toISOString(),
        status: 'error',
        error: errorMessage,
        newInvoicesCount: 0,
        totalInvoicesCount: 0,
        durationMs: duration
      })

      throw error // Re-throw for retry logic
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Get current job running status
   */
  isJobRunning(): boolean {
    return this.isRunning
  }

  /**
   * Get cron schedule
   */
  getSchedule(): string {
    return this.cronSchedule
  }
}

export const backgroundJobService = new BackgroundJobService()
