import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

interface PDFViewerProps {
  url: string
  className?: string
}

export function PDFViewer({ url, className }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error)
    setError('Failed to load PDF')
    setLoading(false)
  }

  function changePage(offset: number) {
    setPageNumber((prevPageNumber) => prevPageNumber + offset)
  }

  function previousPage() {
    changePage(-1)
  }

  function nextPage() {
    changePage(1)
  }

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* PDF Document */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        {loading && (
          <div className="text-sm text-gray-500">Loading PDF...</div>
        )}
        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          error=""
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
            width={Math.min(window.innerWidth - 100, 800)}
          />
        </Document>
      </div>

      {/* Navigation Controls */}
      {numPages && numPages > 1 && (
        <div className="flex items-center justify-center gap-4 p-4 bg-white dark:bg-gray-800 border-t">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={previousPage}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Previous
          </button>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Page {pageNumber} of {numPages}
          </p>
          <button
            type="button"
            disabled={pageNumber >= numPages}
            onClick={nextPage}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
