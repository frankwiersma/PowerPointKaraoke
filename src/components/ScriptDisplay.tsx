import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectPresentationLanguage, getSlidesToAnalyze } from '../utils/languageDetection'

interface ScriptDisplayProps {
  pdfFile: File | null
  currentPage: number
  totalPages: number
  generatedScript: string
  setGeneratedScript: (script: string) => void
  isGenerating: boolean
  setIsGenerating: (generating: boolean) => void
  autoGenerateTrigger: number
  setAutoPlayTrigger: (trigger: number | ((prev: number) => number)) => void
  presentationContext: string
  setPresentationContext: (context: string) => void
  scriptHistory: Record<number, string>
  contentCache: Record<number, string>
  setContentCache: (cache: Record<number, string>) => void
  scriptCache: Record<number, string>
  setScriptCache: (cache: Record<number, string>) => void
  audioCache: Record<number, string>
  setAudioCache: (cache: Record<number, string>) => void
  isExporting: boolean
  presentationLanguage: 'dutch' | 'english' | null
  setPresentationLanguage: (language: 'dutch' | 'english' | null) => void
  languageAnalyzedSlides: number
  setLanguageAnalyzedSlides: (count: number) => void
}

export default function ScriptDisplay({
  pdfFile,
  currentPage,
  totalPages,
  generatedScript,
  setGeneratedScript,
  isGenerating,
  setIsGenerating,
  autoGenerateTrigger,
  setAutoPlayTrigger,
  presentationContext,
  setPresentationContext,
  scriptHistory,
  contentCache,
  setContentCache,
  scriptCache,
  setScriptCache,
  audioCache,
  setAudioCache,
  isExporting,
  presentationLanguage,
  setPresentationLanguage,
  languageAnalyzedSlides,
  setLanguageAnalyzedSlides,
}: ScriptDisplayProps) {
  const [slideText, setSlideText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [showExtractedText, setShowExtractedText] = useState(false)
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scriptsForAnalysis = useRef<string[]>([])

  // Cancel prefetch timeout when export starts
  useEffect(() => {
    if (isExporting && prefetchTimeoutRef.current) {
      console.log('[Prefetch] Cancelling pending prefetch timeout due to export')
      clearTimeout(prefetchTimeoutRef.current)
      prefetchTimeoutRef.current = null
    }
  }, [isExporting])

  // Helper function to extract content from any page
  const extractContentForPage = async (pageNumber: number): Promise<string> => {
    if (!pdfFile) return ''

    return new Promise((resolve) => {
      const fileReader = new FileReader()

      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)

        try {
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
          const page = await pdf.getPage(pageNumber)

          // First try to extract markdown/structured text from PDF
          const textContent = await page.getTextContent()
          const pdfText = textContent.items
            .map((item: any) => item.str)
            .join(' ')

          // Render the page to canvas to get image data for vision analysis
          const viewport = page.getViewport({ scale: 2.0 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')

          if (!context) {
            resolve(pdfText)
            return
          }

          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise

          // Convert canvas to base64 image
          const imageDataUrl = canvas.toDataURL('image/png')

          // Use Azure OpenAI GPT-4o Vision to extract content from images
          const endpoint = import.meta.env.VITE_OPENAI_ENDPOINT
          const apiKey = import.meta.env.VITE_OPENAI_KEY
          const model = import.meta.env.VITE_OPENAI_MODEL
          const apiVersion = import.meta.env.VITE_API_VERSION

          if (!endpoint || !apiKey) {
            resolve(pdfText || '[Azure OpenAI not configured]')
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
            resolve(pdfText || `[Error: ${response.status}]`)
            return
          }

          const data = await response.json()
          const visionExtractedText = data.choices[0]?.message?.content || ''

          // Combine both sources: prefer vision output but fallback to PDF text if needed
          const combinedText = visionExtractedText.trim() || pdfText.trim() || '[No content detected]'
          resolve(combinedText)
        } catch (error: any) {
          console.error('Error extracting content:', error)
          resolve(`[Error: ${error?.message || 'Unknown error'}]`)
        }
      }

      fileReader.readAsArrayBuffer(pdfFile)
    })
  }

  // Extract text and visual content from current slide using Azure OpenAI GPT-4o Vision
  useEffect(() => {
    if (!pdfFile) {
      setSlideText('')
      return
    }

    const extractContent = async () => {
      setIsExtracting(true)

      // Check if we have cached content for this page
      if (contentCache[currentPage]) {
        setSlideText(contentCache[currentPage])
        setIsExtracting(false)
        return
      }

      try {
        const content = await extractContentForPage(currentPage)
        setSlideText(content)

        // Cache the extracted content
        setContentCache(prev => ({ ...prev, [currentPage]: content }))

        setIsExtracting(false)

        // Prefetch next slide content in the background (skip during export)
        // Clear any pending prefetch timeout
        if (prefetchTimeoutRef.current) {
          clearTimeout(prefetchTimeoutRef.current)
        }

        // Use setTimeout to check isExporting status after the current operation
        prefetchTimeoutRef.current = setTimeout(() => {
          if (!isExporting && currentPage < totalPages) {
            const nextPage = currentPage + 1
            if (!contentCache[nextPage]) {
              console.log(`[Prefetch] Prefetching content for slide ${nextPage}`)
              extractContentForPage(nextPage).then(nextContent => {
                if (!isExporting) {
                  setContentCache(prev => ({ ...prev, [nextPage]: nextContent }))
                }
              })
            }
          }
        }, 100)
      } catch (error: any) {
        console.error('Error extracting content:', error)
        setSlideText(`[Error: ${error?.message || 'Unknown error'}]`)
        setIsExtracting(false)
      }
    }

    extractContent()
  }, [pdfFile, currentPage])

  const generateVoiceover = async () => {
    if (!slideText.trim() || slideText.includes('[Error')) {
      alert('No text found on this slide. Please wait for content extraction to complete.')
      return
    }

    setIsGenerating(true)
    setGeneratedScript('')

    try {
      // Use Azure OpenAI GPT-4o for script generation
      const endpoint = import.meta.env.VITE_OPENAI_ENDPOINT
      const apiKey = import.meta.env.VITE_OPENAI_KEY
      const model = import.meta.env.VITE_OPENAI_MODEL
      const apiVersion = import.meta.env.VITE_API_VERSION

      if (!endpoint || !apiKey) {
        alert('Azure OpenAI credentials not configured. Please check your .env file.')
        return
      }

      // Build context from previous slides (limit to last 3 slides to avoid token limits)
      const previousContext = Object.entries(scriptHistory)
        .filter(([page]) => parseInt(page) < currentPage)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .slice(-3) // Only keep last 3 slides for context
        .map(([page, script]) => `Slide ${page}: ${script}`)
        .join('\n')

      // If this is the first slide and no context exists, analyze all slides first
      let contextPrompt = ''
      if (currentPage === 1 && !presentationContext) {
        contextPrompt = `This is slide 1 of ${totalPages}. Based on this first slide, establish the presentation theme and tone that will carry through the entire presentation.`
      } else if (currentPage === 1) {
        contextPrompt = `This is slide 1 of ${totalPages}. ${presentationContext}`
      } else {
        contextPrompt = `This is slide ${currentPage} of ${totalPages}.

Previous presentation flow:
${previousContext}

Continue the natural flow of the presentation. Build on what was said before - don't restart with phrases like "okay folks" or "alright." Transition smoothly from the previous content.`
      }

      const systemPrompt = `You are a charismatic, witty presenter giving a live presentation. The presentation must flow naturally from beginning to end as a coherent story.

CRITICAL RULES:
- Output ONLY the spoken words - no stage directions, no parenthetical actions, no descriptions of gestures or facial expressions
- Do NOT include things like "(smiling)", "(gesturing)", "(pausing)", or any other non-verbal cues
- Do NOT use repetitive opening phrases like "okay folks", "alright", "so", "and this leads us to", "which brings us to", "now we see"
- Do NOT explicitly reference previous slides - just speak about the current slide naturally
- The flow should be IMPLICIT through tone and content, not explicit through transition phrases
- Make it feel like one continuous presentation where each slide naturally builds on the narrative
- Keep the energy and tone consistent with the overall story
- Write only what the presenter would SAY out loud, nothing else
- Focus on the content of THIS slide, but with awareness of the larger narrative`

      const userPrompt = `${contextPrompt}

Current slide content: "${slideText}"

Create a short (2-3 sentences) presenter's script that:
1. ${currentPage === 1 ? 'Opens the presentation with energy and establishes the theme' : 'Speaks directly about THIS slide\'s content while maintaining natural flow - don\'t explicitly reference previous slides or use phrases like "this leads us to" or "and now we see"'}
2. Interprets and presents the slide content with personality and insight
3. ${currentPage === totalPages ? 'Concludes the presentation powerfully' : 'Naturally sets up momentum without forced transitions'}`

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

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Azure OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      const script = data.choices[0]?.message?.content || ''

      // On first slide, extract and save the presentation context using GPT-4o
      if (currentPage === 1 && !presentationContext) {
        const contextResponse = await fetch(
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
                  content: `Based on this first slide: "${slideText}" and this presentation script: "${script}",
                  write a one-sentence summary of the presentation's main theme and tone that will guide the rest of the slides.
                  Format: "This presentation is about [topic] with a [tone/style] approach."`
                }
              ],
              max_tokens: 100,
              temperature: 0.3
            })
          }
        )

        if (contextResponse.ok) {
          const contextData = await contextResponse.json()
          setPresentationContext(contextData.choices[0]?.message?.content || '')
        }
      }

      setGeneratedScript(script)

      // Language detection: collect scripts from first slides to determine language
      if (presentationLanguage === null && currentPage <= getSlidesToAnalyze(totalPages)) {
        scriptsForAnalysis.current.push(script)
        console.log(`[Language] Collected script ${scriptsForAnalysis.current.length}/${getSlidesToAnalyze(totalPages)} for language analysis`)

        // Once we have enough scripts, detect the language
        if (scriptsForAnalysis.current.length >= getSlidesToAnalyze(totalPages)) {
          const detectedLanguage = detectPresentationLanguage(scriptsForAnalysis.current)
          setPresentationLanguage(detectedLanguage)
          setLanguageAnalyzedSlides(scriptsForAnalysis.current.length)
          console.log(`[Language] ✓ Presentation language set to: ${detectedLanguage.toUpperCase()}`)
        }
      }

      // Trigger auto-play after script generation
      setAutoPlayTrigger(prev => prev + 1)
    } catch (error: any) {
      console.error('Error generating script:', error)
      console.error('Error details:', error?.message, error?.response)

      // More detailed error message
      const errorMsg = error?.message || 'Unknown error'
      alert(`Failed to generate voiceover: ${errorMsg}\n\nCheck console for details.`)
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-generate when content extraction completes (slideText updates)
  useEffect(() => {
    // Only auto-generate if we don't already have a script (prevents regenerating cached scripts)
    if (autoGenerateTrigger > 0 && slideText.trim() && !slideText.includes('[Error') && !isExtracting && !isGenerating && !generatedScript) {
      generateVoiceover()
    }
  }, [autoGenerateTrigger, isExtracting])

  // Prefetch next 2 slides' scripts and audio after current script is generated
  useEffect(() => {
    // Skip prefetching if export is running
    if (isExporting) {
      console.log('[Prefetch] Skipping prefetch - export in progress')
      return
    }

    if (!generatedScript || !pdfFile || currentPage >= totalPages) return

    const prefetchUpcomingSlides = async () => {
      // Prefetch up to 2 slides ahead
      const slidesToPrefetch = [currentPage + 1, currentPage + 2].filter(page => page <= totalPages)

      for (const nextPage of slidesToPrefetch) {
        if (scriptCache[nextPage]) {
          console.log(`Slide ${nextPage} script already cached, skipping`)
          continue // Already cached
        }

        const prefetchNextScript = async () => {
      try {
        // Wait for next page content to be available
        let nextContent = contentCache[nextPage]
        if (!nextContent) {
          nextContent = await extractContentForPage(nextPage)

          // Check if export started while we were extracting - don't cache if so
          if (isExporting) {
            console.log(`[Prefetch] ⚠️ Export started during content extraction - discarding prefetched content for slide ${nextPage}`)
            return
          }

          setContentCache(prev => ({ ...prev, [nextPage]: nextContent }))
        }

        if (!nextContent || nextContent.includes('[Error')) return

        // Generate script for next page
        const endpoint = import.meta.env.VITE_OPENAI_ENDPOINT
        const apiKey = import.meta.env.VITE_OPENAI_KEY
        const model = import.meta.env.VITE_OPENAI_MODEL
        const apiVersion = import.meta.env.VITE_API_VERSION

        if (!endpoint || !apiKey) return

        // Build context from script history including current page
        const contextHistory = { ...scriptHistory, [currentPage]: generatedScript }
        const previousContext = Object.entries(contextHistory)
          .filter(([page]) => parseInt(page) < nextPage)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .slice(-3)
          .map(([page, script]) => `Slide ${page}: ${script}`)
          .join('\n')

        const contextPrompt = `This is slide ${nextPage} of ${totalPages}.

Previous presentation flow:
${previousContext}

Continue the natural flow of the presentation. Build on what was said before - don't restart with phrases like "okay folks" or "alright." Transition smoothly from the previous content.`

        const systemPrompt = `You are a charismatic, witty presenter giving a live presentation. The presentation must flow naturally from beginning to end as a coherent story.

CRITICAL RULES:
- Output ONLY the spoken words - no stage directions, no parenthetical actions, no descriptions of gestures or facial expressions
- Do NOT include things like "(smiling)", "(gesturing)", "(pausing)", or any other non-verbal cues
- Do NOT use repetitive opening phrases like "okay folks", "alright", "so", "and this leads us to", "which brings us to", "now we see"
- Do NOT explicitly reference previous slides - just speak about the current slide naturally
- The flow should be IMPLICIT through tone and content, not explicit through transition phrases
- Make it feel like one continuous presentation where each slide naturally builds on the narrative
- Keep the energy and tone consistent with the overall story
- Write only what the presenter would SAY out loud, nothing else
- Focus on the content of THIS slide, but with awareness of the larger narrative`

        const userPrompt = `${contextPrompt}

Current slide content: "${nextContent}"

Create a short (2-3 sentences) presenter's script that:
1. Speaks directly about THIS slide's content while maintaining natural flow - don't explicitly reference previous slides or use phrases like "this leads us to" or "and now we see"
2. Interprets and presents the slide content with personality and insight
3. ${nextPage === totalPages ? 'Concludes the presentation powerfully' : 'Naturally sets up momentum without forced transitions'}`

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

        if (!response.ok) return

        const data = await response.json()
        const nextScript = data.choices[0]?.message?.content || ''

        // Check if export started while we were fetching - don't cache if so
        if (isExporting) {
          console.log(`[Prefetch] ⚠️ Export started during fetch - discarding prefetched script for slide ${nextPage}`)
          return
        }

        // Cache the prefetched script
        setScriptCache(prev => ({ ...prev, [nextPage]: nextScript }))

        console.log(`Prefetched script for slide ${nextPage}`)

        // Now prefetch audio for the next slide
        if (!audioCache[nextPage] && nextScript) {
          // Use presentation language if available, otherwise detect from script
          const isDutch = presentationLanguage === 'dutch' ||
            (presentationLanguage === null && (() => {
              const dutchWords = [
                'de', 'het', 'een', 'van', 'in', 'op', 'voor', 'met', 'aan', 'dat', 'dit',
                'zijn', 'worden', 'hebben', 'kunnen', 'moeten', 'willen', 'gaan', 'maken',
                'deze', 'zoals', 'maar', 'ook', 'niet', 'naar', 'door', 'over', 'om',
                'bij', 'uit', 'naar', 'meer', 'andere', 'alle', 'veel', 'nog', 'wel',
                'bijvoorbeeld', 'namelijk', 'waarom', 'hoe', 'wanneer', 'waar', 'wie'
              ]
              const lowerText = nextScript.toLowerCase()
              const words = lowerText.split(/\s+/)
              const dutchWordCount = words.filter(word =>
                dutchWords.includes(word.replace(/[.,!?;:]$/, ''))
              ).length
              const threshold = words.length * 0.2
              return dutchWordCount >= threshold && dutchWordCount >= 3
            })())

          console.log(`Prefetching audio for slide ${nextPage} - Language: ${isDutch ? 'Dutch (ElevenLabs)' : 'English (Deepgram)'}`)

          try {
            let audioResponse
            if (isDutch) {
              // Use ElevenLabs for Dutch
              const elevenlabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY
              const voiceId = import.meta.env.VITE_ELEVENLABS_DUTCH_VOICE_ID

              if (elevenlabsKey && voiceId) {
                audioResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                  method: 'POST',
                  headers: {
                    'xi-api-key': elevenlabsKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    text: nextScript,
                    model_id: 'eleven_multilingual_v2',
                  }),
                })
              }
            } else {
              // Use Deepgram for other languages
              const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY
              if (deepgramKey && deepgramKey !== 'your_deepgram_api_key_here') {
                audioResponse = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-hermes-en', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Token ${deepgramKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    text: nextScript,
                  }),
                })
              }
            }

            if (audioResponse && audioResponse.ok) {
              const audioBlob = await audioResponse.blob()

              // Check if export started while we were fetching - don't cache if so
              if (isExporting) {
                console.log(`[Prefetch] ⚠️ Export started during audio fetch - discarding prefetched audio for slide ${nextPage}`)
                URL.revokeObjectURL(URL.createObjectURL(audioBlob)) // Clean up
                return
              }

              const audioUrl = URL.createObjectURL(audioBlob)
              setAudioCache(prev => ({ ...prev, [nextPage]: audioUrl }))
              console.log(`Prefetched ${isDutch ? 'ElevenLabs' : 'Deepgram'} audio for slide ${nextPage}`)
            }
          } catch (audioError) {
            console.error('Error prefetching audio:', audioError)
          }
        }
      } catch (error) {
        console.error(`Error prefetching script for slide ${nextPage}:`, error)
      }
    }

        await prefetchNextScript()
      }
    }

    prefetchUpcomingSlides()
  }, [generatedScript, currentPage, totalPages, isExporting])

  return (
    <div className="flex-1 flex flex-col gap-2" style={{ padding: '0!important', margin: '0!important' }}>
      {/* Generate Button */}
      <button
        onClick={generateVoiceover}
        disabled={!pdfFile || isGenerating || isExtracting}
        className={`
          group relative overflow-hidden rounded-lg py-2.5 px-4 font-bold text-sm
          transition-all duration-300 transform
          ${!pdfFile || isGenerating || isExtracting
            ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white hover:scale-[1.02] shadow-lg hover:shadow-2xl hover:shadow-purple-500/40'
          }
        `}
        style={{ backgroundSize: '200% 200%' }}
      >
        {/* Animated gradient background */}
        {!isGenerating && !isExtracting && pdfFile && (
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundSize: '200% 200%', animation: 'gradient-shift 3s ease infinite' }}></div>
        )}

        <div className="relative flex items-center justify-center space-x-2" style={{ padding: '0!important', margin: '0!important' }}>
          {isGenerating ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Generating Script...</span>
            </>
          ) : isExtracting ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Extracting Content...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              <span>Generate Voiceover</span>
            </>
          )}
        </div>
      </button>

      {/* Extracted Text Section */}
      {slideText && (
        <div
          className="glass-light rounded-lg overflow-hidden border border-gray-700/50 transition-all duration-300 hover:shadow-lg"
          style={{
            padding: '0!important',
            margin: '0!important',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <button
            onClick={() => setShowExtractedText(!showExtractedText)}
            className="w-full py-2 px-3 flex items-center justify-between text-xs font-medium text-gray-300 hover:bg-gray-700/30 transition-all duration-200"
            style={{ margin: '0!important' }}
          >
            <div className="flex items-center space-x-2" style={{ padding: '0!important', margin: '0!important' }}>
              <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span>Extracted Content</span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showExtractedText ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExtractedText && (
            <div
              className="px-3 py-2 max-h-32 overflow-y-auto border-t border-gray-700/50 custom-scrollbar bg-gray-800/30"
              style={{ margin: '0!important', animation: 'slideInRight 0.2s ease-out' }}
            >
              {isExtracting ? (
                // Skeleton loader
                <div className="space-y-1" style={{ padding: '0!important', margin: '0!important' }}>
                  <div className="skeleton skeleton-text"></div>
                  <div className="skeleton skeleton-text"></div>
                  <div className="skeleton skeleton-text"></div>
                </div>
              ) : (
                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
                  {slideText}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
