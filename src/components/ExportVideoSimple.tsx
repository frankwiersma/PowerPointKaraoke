import { useState, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

interface ExportVideoSimpleProps {
  pdfFile: File | null
  totalPages: number
  scriptCache: Record<number, string>
  audioCache: Record<number, string>
  setScriptCache: (cache: Record<number, string>) => void
  setAudioCache: (cache: Record<number, string>) => void
  contentCache: Record<number, string>
  setContentCache: (cache: Record<number, string>) => void
  presentationContext: string
  setPresentationContext: (context: string) => void
  scriptHistory: Record<number, string>
}

export default function ExportVideoSimple({
  pdfFile,
  totalPages,
  scriptCache,
  audioCache,
  setScriptCache,
  setAudioCache,
  contentCache,
  setContentCache,
  presentationContext,
  setPresentationContext,
  scriptHistory,
}: ExportVideoSimpleProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleCancel = () => {
    console.log('[Export] Cancelling export...')
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsExporting(false)
    setProgress('')
    setCurrentSlide(0)
  }

  // Helper: Extract content from a page
  const extractContentForPage = async (pageNumber: number, file: File): Promise<string> => {
    return new Promise((resolve) => {
      const fileReader = new FileReader()

      fileReader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
          const page = await pdf.getPage(pageNumber)

          // Render the page to canvas
          const viewport = page.getViewport({ scale: 2.0 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')

          if (!context) {
            resolve('[Canvas error]')
            return
          }

          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise

          // Convert to base64
          const imageDataUrl = canvas.toDataURL('image/png')

          // Use Azure OpenAI Vision to extract content
          const endpoint = import.meta.env.VITE_OPENAI_ENDPOINT
          const apiKey = import.meta.env.VITE_OPENAI_KEY
          const model = import.meta.env.VITE_OPENAI_MODEL
          const apiVersion = import.meta.env.VITE_API_VERSION

          if (!endpoint || !apiKey) {
            resolve('[Azure OpenAI not configured]')
            return
          }

          const response = await fetch(
            `${endpoint}openai/deployments/${model}/chat/completions?api-version=${apiVersion}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Extract ALL visible text from this presentation slide, including text in images, charts, diagrams, screenshots, and any visual elements. Provide the complete text content in markdown format, preserving structure and hierarchy. Include bullet points, headings, and formatting.'
                      },
                      {
                        type: 'image_url',
                        image_url: {
                          url: imageDataUrl
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 2000,
                temperature: 0.1
              })
            }
          )

          if (!response.ok) {
            resolve('[Extraction error]')
            return
          }

          const data = await response.json()
          const content = data.choices[0]?.message?.content || ''
          resolve(content)
        } catch (error) {
          console.error('Error extracting content:', error)
          resolve('[Error]')
        }
      }

      fileReader.readAsArrayBuffer(file)
    })
  }

  // Helper: Generate script for a slide
  const generateScriptForSlide = async (
    pageNumber: number,
    content: string,
    history: Record<number, string>,
    context: string,
    total: number
  ): Promise<string | null> => {
    try {
      const endpoint = import.meta.env.VITE_OPENAI_ENDPOINT
      const apiKey = import.meta.env.VITE_OPENAI_KEY
      const model = import.meta.env.VITE_OPENAI_MODEL
      const apiVersion = import.meta.env.VITE_API_VERSION

      if (!endpoint || !apiKey) return null

      // Build context from previous slides
      const previousContext = Object.entries(history)
        .filter(([page]) => parseInt(page) < pageNumber)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .slice(-3)
        .map(([page, script]) => `Slide ${page}: ${script}`)
        .join('\n')

      const contextPrompt = pageNumber === 1
        ? `This is slide 1 of ${total}. Based on this first slide, establish the presentation theme and tone.`
        : `This is slide ${pageNumber} of ${total}.\n\nPrevious presentation flow:\n${previousContext}\n\nContinue the natural flow of the presentation.`

      const systemPrompt = `You are a charismatic, witty presenter giving a live presentation. The presentation must flow naturally from beginning to end as a coherent story.

CRITICAL RULES:
- Output ONLY the spoken words - no stage directions, no parenthetical actions
- Do NOT use repetitive opening phrases like "okay folks", "alright", "so"
- Do NOT explicitly reference previous slides
- The flow should be IMPLICIT through tone and content
- Write only what the presenter would SAY out loud, nothing else`

      const userPrompt = `${contextPrompt}

Current slide content: "${content}"

Create a short (2-3 sentences) presenter's script that:
1. ${pageNumber === 1 ? 'Opens the presentation with energy' : 'Speaks naturally about THIS slide'}
2. Interprets and presents the slide content with personality
3. ${pageNumber === total ? 'Concludes powerfully' : 'Sets up momentum without forced transitions'}`

      const response = await fetch(
        `${endpoint}openai/deployments/${model}/chat/completions?api-version=${apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            max_tokens: 500,
            temperature: 0.7
          })
        }
      )

      if (!response.ok) return null

      const data = await response.json()
      return data.choices[0]?.message?.content || null
    } catch (error) {
      console.error('Error generating script:', error)
      return null
    }
  }

  // Helper: Detect if text is Dutch
  const isDutchText = (text: string): boolean => {
    const dutchWords = [
      'de', 'het', 'een', 'van', 'in', 'op', 'voor', 'met', 'aan', 'dat', 'dit',
      'zijn', 'worden', 'hebben', 'kunnen', 'moeten', 'willen', 'gaan', 'maken',
      'deze', 'zoals', 'maar', 'ook', 'niet', 'naar', 'door', 'over', 'om'
    ]
    const lowerText = text.toLowerCase()
    const words = lowerText.split(/\s+/)
    const dutchWordCount = words.filter(word =>
      dutchWords.includes(word.replace(/[.,!?;:]$/, ''))
    ).length
    const threshold = words.length * 0.2
    return dutchWordCount >= threshold && dutchWordCount >= 3
  }

  // Helper: Generate audio for script
  const generateAudioForScript = async (script: string): Promise<Blob | null> => {
    try {
      const isDutch = isDutchText(script)

      if (isDutch) {
        // Use ElevenLabs for Dutch
        const elevenlabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY
        const voiceId = import.meta.env.VITE_ELEVENLABS_DUTCH_VOICE_ID

        if (!elevenlabsKey || !voiceId) return null

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenlabsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script,
            model_id: 'eleven_multilingual_v2',
          }),
        })

        if (!response.ok) return null
        return await response.blob()
      } else {
        // Use Deepgram for English
        const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY

        if (!deepgramKey || deepgramKey === 'your_deepgram_api_key_here') return null

        const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-hermes-en', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script,
          }),
        })

        if (!response.ok) return null
        return await response.blob()
      }
    } catch (error) {
      console.error('Error generating audio:', error)
      return null
    }
  }

  const handleExport = async () => {
    if (!pdfFile || totalPages === 0) {
      alert('Please upload a PDF first')
      return
    }

    setIsExporting(true)
    setCurrentSlide(0)
    abortControllerRef.current = new AbortController()

    try {
      setProgress('Creating presentation package...')
      console.log('[Export] Starting simple export')

      const zip = new JSZip()
      const failedSlides: number[] = []

      // Create a README file
      zip.file('README.txt',
        `PowerPoint Karaoke AI - Export\n\n` +
        `This package contains your presentation slides with audio narration.\n\n` +
        `Contents:\n` +
        `- slides/ - PNG images of each slide\n` +
        `- audio/ - MP3 audio files for each slide\n` +
        `- scripts/ - Text scripts for each slide\n\n` +
        `To create a video:\n` +
        `1. Use video editing software (iMovie, Adobe Premiere, DaVinci Resolve, etc.)\n` +
        `2. Import slides in order\n` +
        `3. Add corresponding audio to each slide\n` +
        `4. Set slide duration to match audio length\n` +
        `5. Export as MP4\n\n` +
        `Generated: ${new Date().toISOString()}\n`
      )

      // Process each slide
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setCurrentSlide(pageNum)
        setProgress(`Processing slide ${pageNum}/${totalPages}...`)
        console.log(`[Export] Processing slide ${pageNum}`)

        try {
          // Get or generate script
          let script = scriptCache[pageNum]
          if (!script) {
            console.log(`[Export] No cached script for slide ${pageNum}, generating now...`)
            setProgress(`Generating script for slide ${pageNum}/${totalPages}...`)

            // Extract content first
            let content = contentCache[pageNum]
            if (!content) {
              console.log(`[Export] Extracting content for slide ${pageNum}...`)
              setProgress(`Extracting content for slide ${pageNum}/${totalPages}...`)
              content = await extractContentForPage(pageNum, pdfFile)
              setContentCache(prev => ({ ...prev, [pageNum]: content }))
            }

            if (!content || content.includes('[Error')) {
              console.warn(`[Export] No content for slide ${pageNum}, skipping`)
              failedSlides.push(pageNum)
              continue
            }

            // Generate script
            script = await generateScriptForSlide(pageNum, content, scriptHistory, presentationContext, totalPages)
            if (!script) {
              console.warn(`[Export] Failed to generate script for slide ${pageNum}, skipping`)
              failedSlides.push(pageNum)
              continue
            }

            setScriptCache(prev => ({ ...prev, [pageNum]: script }))
          }

          // Get or generate audio
          let audioBlob: Blob | null = null
          if (audioCache[pageNum]) {
            const response = await fetch(audioCache[pageNum])
            audioBlob = await response.blob()
          } else {
            console.log(`[Export] No cached audio for slide ${pageNum}, generating now...`)
            setProgress(`Generating audio for slide ${pageNum}/${totalPages}...`)
            audioBlob = await generateAudioForScript(script)

            if (audioBlob) {
              const audioUrl = URL.createObjectURL(audioBlob)
              setAudioCache(prev => ({ ...prev, [pageNum]: audioUrl }))
            }
          }

          if (!audioBlob) {
            console.warn(`[Export] No audio for slide ${pageNum}, skipping`)
            failedSlides.push(pageNum)
            continue
          }

          // Render slide to image
          setProgress(`Rendering slide ${pageNum}/${totalPages}...`)
          const slideImage = await renderSlideToImage(pageNum, pdfFile)

          // Add files to zip
          zip.folder('slides')!.file(`slide-${String(pageNum).padStart(2, '0')}.png`, slideImage)
          zip.folder('audio')!.file(`audio-${String(pageNum).padStart(2, '0')}.mp3`, audioBlob)
          zip.folder('scripts')!.file(`script-${String(pageNum).padStart(2, '0')}.txt`, script)

          console.log(`[Export] Slide ${pageNum} added to package`)
        } catch (error: any) {
          console.error(`[Export] Error processing slide ${pageNum}:`, error)
          failedSlides.push(pageNum)
        }
      }

      if (totalPages - failedSlides.length === 0) {
        throw new Error('No slides could be processed')
      }

      // Generate ZIP file
      setProgress('Creating download package...')
      console.log('[Export] Generating ZIP file')

      const zipBlob = await zip.generateAsync({ type: 'blob' })

      // Download
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presentation-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('[Export] Export complete!')

      if (failedSlides.length > 0) {
        alert(
          `Export complete!\n\n` +
          `Included: ${totalPages - failedSlides.length} slides\n` +
          `Skipped: ${failedSlides.length} slides (${failedSlides.join(', ')})\n\n` +
          `The ZIP file contains slides, audio, and scripts.\n` +
          `Use video editing software to combine them into a video.`
        )
      } else {
        alert(
          `Export complete!\n\n` +
          `All ${totalPages} slides exported successfully.\n\n` +
          `The ZIP file contains slides, audio, and scripts.\n` +
          `Use video editing software to combine them into a video.`
        )
      }

      setProgress('Complete!')
      setTimeout(() => {
        setIsExporting(false)
        setProgress('')
        setCurrentSlide(0)
      }, 2000)

    } catch (error: any) {
      console.error('Export error:', error)
      alert(`Export failed: ${error.message}`)
      setIsExporting(false)
      setProgress('')
      setCurrentSlide(0)
    }
  }

  const renderSlideToImage = async (pageNumber: number, file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader()

      fileReader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
          const page = await pdf.getPage(pageNumber)

          const viewport = page.getViewport({ scale: 1.0 })
          const desiredWidth = 1920
          const scale = desiredWidth / viewport.width
          const scaledViewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')

          if (!context) throw new Error('Canvas context not available')

          canvas.width = scaledViewport.width
          canvas.height = scaledViewport.height

          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)

          await page.render({
            canvasContext: context,
            viewport: scaledViewport,
          }).promise

          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to convert canvas to blob'))
          }, 'image/png')
        } catch (error) {
          reject(error)
        }
      }

      fileReader.readAsArrayBuffer(file)
    })
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={!pdfFile || totalPages === 0 || isExporting}
        className={`
          group relative overflow-hidden rounded-lg py-2.5 px-4 font-bold text-sm w-full
          transition-all duration-300 transform
          ${!pdfFile || totalPages === 0 || isExporting
            ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 text-white hover:scale-[1.02] shadow-lg hover:shadow-2xl hover:shadow-teal-500/40'
          }
        `}
      >
        {!isExporting && pdfFile && (
          <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundSize: '200% 200%', animation: 'gradient-shift 3s ease infinite' }}></div>
        )}

        <div className="relative flex items-center justify-center space-x-2">
          {isExporting ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
              </svg>
              <span>Export as ZIP (Instant)</span>
            </>
          )}
        </div>
      </button>

      {isExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass rounded-xl p-6 max-w-md w-full mx-4 border border-teal-500/30 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-teal-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                    <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Exporting Package</h2>
                  <p className="text-sm text-gray-400">Creating ZIP file...</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-300">{progress}</p>

                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-600 to-teal-600 transition-all duration-300 rounded-full"
                    style={{ width: `${totalPages > 0 ? (currentSlide / totalPages) * 100 : 0}%` }}
                  ></div>
                </div>

                <p className="text-xs text-gray-500 text-right">
                  Slide {currentSlide} of {totalPages}
                </p>
              </div>

              <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">
                  Packaging slides, audio, and scripts. This is much faster than video encoding!
                </p>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm bg-red-600/80 hover:bg-red-600 text-white transition-all duration-200 border border-red-500/50"
              >
                Cancel Export
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
