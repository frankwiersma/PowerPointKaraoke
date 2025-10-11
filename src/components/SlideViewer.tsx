import { useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Set up the worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface SlideViewerProps {
  pdfFile: File | null
  currentPage: number
  setTotalPages: (total: number) => void
}

export default function SlideViewer({ pdfFile, currentPage, setTotalPages }: SlideViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<any>(null)

  // Load PDF when file changes
  useEffect(() => {
    if (!pdfFile) {
      setTotalPages(0)
      return
    }

    const loadPdf = async () => {
      const fileReader = new FileReader()

      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)

        try {
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
          pdfDocRef.current = pdf
          setTotalPages(pdf.numPages)
        } catch (error) {
          console.error('Error loading PDF:', error)
          alert('Failed to load PDF file')
        }
      }

      fileReader.readAsArrayBuffer(pdfFile)
    }

    loadPdf()
  }, [pdfFile, setTotalPages])

  // Render current page
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current) return

    const renderPage = async () => {
      try {
        const page = await pdfDocRef.current.getPage(currentPage)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (!context) return

        // Calculate scale to fit the canvas
        const viewport = page.getViewport({ scale: 1 })
        const canvasContainer = canvas.parentElement
        if (!canvasContainer) return

        const scaleX = canvasContainer.clientWidth / viewport.width
        const scaleY = canvasContainer.clientHeight / viewport.height
        const scale = Math.min(scaleX, scaleY) * 0.95 // 95% to add some padding

        const scaledViewport = page.getViewport({ scale })

        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        }

        await page.render(renderContext).promise
      } catch (error) {
        console.error('Error rendering page:', error)
      }
    }

    renderPage()
  }, [currentPage])

  return (
    <div className="flex-1 h-full bg-gray-900 flex items-center justify-center">
      {pdfFile ? (
        <canvas ref={canvasRef} className="w-full h-full" />
      ) : (
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-24 w-24 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-xl">No PDF loaded</p>
          <p className="text-sm mt-2">Upload a PDF to get started</p>
        </div>
      )}
    </div>
  )
}
