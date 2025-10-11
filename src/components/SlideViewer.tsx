import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Set up the worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface SlideViewerProps {
  pdfFile: File | null
  currentPage: number
  setTotalPages: (total: number) => void
  generatedScript: string
}

export default function SlideViewer({ pdfFile, currentPage, setTotalPages, generatedScript }: SlideViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Load PDF when file changes
  useEffect(() => {
    if (!pdfFile) {
      setTotalPages(0)
      return
    }

    const loadPdf = async () => {
      setIsLoading(true)
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
        } finally {
          setIsLoading(false)
        }
      }

      fileReader.readAsArrayBuffer(pdfFile)
    }

    loadPdf()
  }, [pdfFile, setTotalPages])

  // Render current page with transition
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current) return

    const renderPage = async () => {
      setIsTransitioning(true)

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

        // Delay to show transition
        setTimeout(() => setIsTransitioning(false), 300)
      } catch (error) {
        console.error('Error rendering page:', error)
        setIsTransitioning(false)
      }
    }

    renderPage()
  }, [currentPage])

  return (
    <div className="w-full h-full flex flex-col" style={{ padding: '1rem', margin: 0, gap: '1rem' }}>
      {pdfFile ? (
        <>
          {/* PDF Slide Container */}
          <div className="relative flex-1" style={{ minHeight: 0 }}>
            {/* Canvas Container with Glass Effect */}
            <div
              className={`
                relative rounded-2xl shadow-2xl overflow-hidden border border-purple-500/40
                transition-all duration-300 w-full h-full
                ${isTransitioning ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'}
              `}
              style={{
                padding: '1.5rem',
                margin: 0,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 0 60px rgba(168, 85, 247, 0.3), 0 0 30px rgba(236, 72, 153, 0.2)'
              }}
            >
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-purple-500/60 rounded-tl-2xl"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-pink-500/60 rounded-tr-2xl"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-purple-500/60 rounded-bl-2xl"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-pink-500/60 rounded-br-2xl"></div>

            {/* White background for canvas */}
            <div
              className="relative w-full h-full flex items-center justify-center rounded-xl"
              style={{
                background: '#ffffff',
                padding: '0.5rem',
                margin: 0
              }}
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full rounded-lg shadow-lg transition-all duration-300"
                style={{
                  margin: 0,
                  padding: 0
                }}
              />
            </div>

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto">
                    <svg className="animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <p className="text-white font-medium">Loading presentation...</p>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Presenter Script Section - Always visible */}
          <div
            className="glass rounded-lg overflow-hidden border border-gray-700/50 shadow-xl"
            style={{
              padding: 0,
              margin: 0,
              maxHeight: '30%',
              animation: 'fadeIn 0.3s ease-out'
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-3 py-2 border-b border-gray-700/50">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">Presenter Script</h3>
                    <p className="text-xs text-gray-400">
                      {generatedScript ? 'Your AI-generated voiceover' : 'Awaiting script generation'}
                    </p>
                  </div>
                </div>
              </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(30vh - 60px)' }}>
              {generatedScript ? (
                <>
                  <p className="text-base text-gray-200 leading-relaxed">
                    {generatedScript}
                  </p>

                  {/* Word count indicator */}
                  <div className="flex items-center space-x-2 pt-3 mt-3 border-t border-gray-700/30">
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-gray-500">
                      {generatedScript.split(' ').length} words • ~{Math.ceil(generatedScript.split(' ').length / 150)} min read
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">No script generated yet</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        // Empty State
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="relative inline-block">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 blur-3xl opacity-30 animate-pulse"></div>

            {/* Icon container */}
            <div
              className="relative rounded-3xl p-8"
              style={{
                margin: 0,
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}
            >
              <svg
                className="w-32 h-32 text-purple-300"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 12h4M10 16h4M10 8h1"
                />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h3 className="text-3xl font-bold text-white">No Presentation Loaded</h3>
            <p className="text-lg text-gray-300 max-w-md mx-auto">
              Upload a PDF presentation to get started with AI-powered voiceovers
            </p>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <div
              className="px-4 py-2 rounded-full flex items-center space-x-2"
              style={{
                margin: 0,
                background: 'rgba(168, 85, 247, 0.15)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}
            >
              <svg className="w-5 h-5 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-white">AI Vision</span>
            </div>
            <div
              className="px-4 py-2 rounded-full flex items-center space-x-2"
              style={{
                margin: 0,
                background: 'rgba(236, 72, 153, 0.15)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(236, 72, 153, 0.3)'
              }}
            >
              <svg className="w-5 h-5 text-pink-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-white">Voice Synthesis</span>
            </div>
            <div
              className="px-4 py-2 rounded-full flex items-center space-x-2"
              style={{
                margin: 0,
                background: 'rgba(251, 146, 60, 0.15)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(251, 146, 60, 0.3)'
              }}
            >
              <svg className="w-5 h-5 text-orange-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 7H7v6h6V7z" />
                <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-white">Auto Generation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
