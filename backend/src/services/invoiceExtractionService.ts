import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

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
}

class InvoiceExtractionService {
  private genAI: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables')
    }
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async extractInvoiceData(pdfBase64: string): Promise<InvoiceData> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = `Analyzuj tento dokument faktury a extrahuj následující údaje ve formátu JSON.

Pokud nějaký údaj není na faktuře, vrať null pro daný field.

Vrať JSON objekt s těmito fieldy:
{
  "invoiceNumber": "číslo faktury",
  "issueDate": "datum vystavení ve formátu YYYY-MM-DD",
  "dueDate": "datum splatnosti ve formátu YYYY-MM-DD",
  "supplierName": "název dodavatele",
  "supplierICO": "IČO dodavatele (jen čísla)",
  "supplierDIC": "DIČ dodavatele",
  "totalAmount": celková částka včetně DPH jako číslo,
  "amountWithoutVAT": částka bez DPH jako číslo,
  "vatAmount": DPH částka jako číslo,
  "variableSymbol": "variabilní symbol",
  "currency": "měna (CZK, EUR, atd.)",
  "bankAccount": "číslo bankovního účtu dodavatele"
}

DŮLEŽITÉ: Vrať POUZE validní JSON objekt, bez jakéhokoliv dalšího textu před nebo za JSON.`

      const result = await model.generateContent([
        {
          inlineData: {
            data: pdfBase64,
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ])

      const response = await result.response
      const text = response.text()

      // Remove markdown code blocks if present
      let jsonText = text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '')
      }

      const invoiceData: InvoiceData = JSON.parse(jsonText.trim())

      console.log('Extracted invoice data:', invoiceData)

      return invoiceData
    } catch (error) {
      console.error('Error extracting invoice data:', error)
      throw new Error('Failed to extract invoice data from PDF')
    }
  }
}

export const invoiceExtractionService = new InvoiceExtractionService()
