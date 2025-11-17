import { Client } from '@microsoft/microsoft-graph-client'

export interface EmailAttachment {
  id: string
  name: string
  contentType: string
  size: number
}

export interface EmailMessage {
  id: string
  subject: string
  from: string
  receivedDateTime: string
  hasAttachments: boolean
  attachments?: EmailAttachment[]
}

class GraphService {
  private getClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })
  }

  async listAllFolders(accessToken: string): Promise<any[]> {
    const client = this.getClient(accessToken)

    try {
      const folders = await client.api('/me/mailFolders').get()
      return folders.value
    } catch (error) {
      console.error('Error listing folders:', error)
      throw error
    }
  }

  async getEmailsFromFolder(accessToken: string, folderName: string): Promise<EmailMessage[]> {
    const client = this.getClient(accessToken)

    try {
      // First, find the folder by name
      const folders = await client.api('/me/mailFolders').get()

      console.log('Available folders:', folders.value.map((f: any) => f.displayName))

      const targetFolder = folders.value.find(
        (folder: any) => folder.displayName.toLowerCase() === folderName.toLowerCase()
      )

      if (!targetFolder) {
        const availableFolders = folders.value.map((f: any) => f.displayName).join(', ')
        throw new Error(`Folder "${folderName}" not found. Available folders: ${availableFolders}`)
      }

      // Get messages from the folder
      const messages = await client
        .api(`/me/mailFolders/${targetFolder.id}/messages`)
        .select('id,subject,from,receivedDateTime,hasAttachments')
        .orderby('receivedDateTime DESC')
        .top(50)
        .get()

      return messages.value.map((msg: any) => ({
        id: msg.id,
        subject: msg.subject,
        from: msg.from?.emailAddress?.address || 'Unknown',
        receivedDateTime: msg.receivedDateTime,
        hasAttachments: msg.hasAttachments,
      }))
    } catch (error) {
      console.error('Error fetching emails:', error)
      throw error
    }
  }

  async getEmailAttachments(accessToken: string, messageId: string): Promise<EmailAttachment[]> {
    const client = this.getClient(accessToken)

    try {
      const attachments = await client
        .api(`/me/messages/${messageId}/attachments`)
        .select('id,name,contentType,size')
        .get()

      return attachments.value
        .filter((att: any) => att.contentType === 'application/pdf')
        .map((att: any) => ({
          id: att.id,
          name: att.name,
          contentType: att.contentType,
          size: att.size,
        }))
    } catch (error) {
      console.error('Error fetching attachments:', error)
      throw error
    }
  }

  async getAttachmentContent(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<string> {
    const client = this.getClient(accessToken)

    try {
      const attachment = await client
        .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
        .get()

      return attachment.contentBytes
    } catch (error) {
      console.error('Error fetching attachment content:', error)
      throw error
    }
  }

  /**
   * Batch fetch attachments for multiple messages (fixes N+1 query pattern)
   */
  async getBatchEmailAttachments(
    accessToken: string,
    messageIds: string[]
  ): Promise<Record<string, EmailAttachment[]>> {
    const client = this.getClient(accessToken)

    try {
      // Fetch attachments for all messages in parallel
      const attachmentPromises = messageIds.map(async (messageId) => {
        try {
          const attachments = await this.getEmailAttachments(accessToken, messageId)
          return { messageId, attachments }
        } catch (error) {
          console.error(`Error fetching attachments for message ${messageId}:`, error)
          // Return empty array for failed requests instead of failing the entire batch
          return { messageId, attachments: [] }
        }
      })

      const results = await Promise.all(attachmentPromises)

      // Convert array to object keyed by messageId
      return results.reduce(
        (acc, { messageId, attachments }) => {
          acc[messageId] = attachments
          return acc
        },
        {} as Record<string, EmailAttachment[]>
      )
    } catch (error) {
      console.error('Error in batch fetch attachments:', error)
      throw error
    }
  }
}

export const graphService = new GraphService()
