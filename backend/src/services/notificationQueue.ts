interface NotificationTask {
  id: string
  type: 'discord'
  payload: any
  retries: number
  createdAt: Date
}

class NotificationQueue {
  private queue: NotificationTask[] = []
  private processing = false
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 5000 // 5 seconds

  /**
   * Add a notification to the queue for background processing
   */
  enqueue(type: 'discord', payload: any) {
    const task: NotificationTask = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      payload,
      retries: 0,
      createdAt: new Date(),
    }

    this.queue.push(task)
    console.log(`Queued notification: ${task.id}`)

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }
  }

  /**
   * Process queued notifications in the background
   */
  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }

    this.processing = true
    const task = this.queue[0]

    try {
      await this.processTask(task)
      // Success - remove from queue
      this.queue.shift()
      console.log(`Successfully processed notification: ${task.id}`)
    } catch (error) {
      console.error(`Failed to process notification ${task.id}:`, error)

      task.retries++
      if (task.retries >= this.MAX_RETRIES) {
        console.error(`Max retries reached for ${task.id}, discarding`)
        this.queue.shift()
      } else {
        console.log(`Retrying ${task.id} (attempt ${task.retries + 1}/${this.MAX_RETRIES})`)
        // Move to end of queue and retry later
        this.queue.shift()
        this.queue.push(task)

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY))
      }
    }

    // Process next item
    setImmediate(() => this.processQueue())
  }

  /**
   * Process a single notification task
   */
  private async processTask(task: NotificationTask) {
    if (task.type === 'discord') {
      await this.sendDiscordNotification(task.payload)
    }
  }

  /**
   * Send a Discord webhook notification
   */
  private async sendDiscordNotification(payload: any) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL

    if (!webhookUrl) {
      console.warn('DISCORD_WEBHOOK_URL not set, skipping notification')
      return
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`)
    }

    // Respect Discord rate limits (1 request per second)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  /**
   * Get current queue length (for monitoring)
   */
  getQueueLength(): number {
    return this.queue.length
  }
}

export const notificationQueue = new NotificationQueue()
