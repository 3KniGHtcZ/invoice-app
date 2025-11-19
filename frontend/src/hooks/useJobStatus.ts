import { useState, useEffect, useCallback } from 'react'

export interface JobState {
  jobName: string
  lastRunTimestamp: string | null
  lastRunDurationMs: number | null
  lastStatus: 'idle' | 'running' | 'success' | 'error'
  lastError: string | null
  newInvoicesCount: number
  totalInvoicesCount: number
  consecutiveErrors: number
  nextScheduledRun: string | null
}

interface UseJobStatusReturn {
  jobState: JobState | null
  isLoading: boolean
  error: string | null
  triggerJob: () => Promise<void>
  refetch: () => Promise<void>
}

const POLL_INTERVAL = 30000 // 30 seconds

export function useJobStatus(): UseJobStatusReturn {
  const [jobState, setJobState] = useState<JobState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobState = useCallback(async () => {
    try {
      const response = await fetch('/api/emails/job/state', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch job state: ${response.statusText}`)
      }

      const data = await response.json()
      setJobState(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching job state:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const triggerJob = useCallback(async () => {
    try {
      const response = await fetch('/api/emails/job/trigger', {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to trigger job')
      }

      // Immediately refetch to show updated state
      await fetchJobState()
    } catch (err) {
      console.error('Error triggering job:', err)
      setError(err instanceof Error ? err.message : 'Failed to trigger job')
      throw err
    }
  }, [fetchJobState])

  // Initial fetch
  useEffect(() => {
    fetchJobState()
  }, [fetchJobState])

  // Polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchJobState()
    }, POLL_INTERVAL)

    return () => clearInterval(intervalId)
  }, [fetchJobState])

  return {
    jobState,
    isLoading,
    error,
    triggerJob,
    refetch: fetchJobState
  }
}
