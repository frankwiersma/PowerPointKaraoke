import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
}: ScriptDisplayProps) {
  const [slideText, setSlideText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [showExtractedText, setShowExtractedText] = useState(false)

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

        // Prefetch next slide content in the background
        if (currentPage < totalPages) {
          const nextPage = currentPage + 1
          if (!contentCache[nextPage]) {
            extractContentForPage(nextPage).then(nextContent => {
              setContentCache(prev => ({ ...prev, [nextPage]: nextContent }))
            })
          }
        }
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
    if (autoGenerateTrigger > 0 && slideText.trim() && !slideText.includes('[Error') && !isExtracting) {
      generateVoiceover()
    }
  }, [slideText, isExtracting])

  // Prefetch next slide's script after current script is generated
  useEffect(() => {
    if (!generatedScript || !pdfFile || currentPage >= totalPages) return

    const nextPage = currentPage + 1
    if (scriptCache[nextPage]) return // Already cached

    const prefetchNextScript = async () => {
      try {
        // Wait for next page content to be available
        let nextContent = contentCache[nextPage]
        if (!nextContent) {
          nextContent = await extractContentForPage(nextPage)
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

        // Cache the prefetched script
        setScriptCache(prev => ({ ...prev, [nextPage]: nextScript }))

        console.log(`Prefetched script for slide ${nextPage}`)

        // Now prefetch audio for the next slide
        if (!audioCache[nextPage] && nextScript) {
          const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
          if (apiKey && apiKey !== 'your_deepgram_api_key_here') {
            try {
              const audioResponse = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-hermes-en', {
                method: 'POST',
                headers: {
                  'Authorization': `Token ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: nextScript,
                }),
              })

              if (audioResponse.ok) {
                const audioBlob = await audioResponse.blob()
                const audioUrl = URL.createObjectURL(audioBlob)
                setAudioCache(prev => ({ ...prev, [nextPage]: audioUrl }))
                console.log(`Prefetched audio for slide ${nextPage}`)
              }
            } catch (audioError) {
              console.error('Error prefetching audio:', audioError)
            }
          }
        }
      } catch (error) {
        console.error('Error prefetching next script:', error)
      }
    }

    prefetchNextScript()
  }, [generatedScript, currentPage, totalPages])

  return (
    <div className="flex-1 flex flex-col gap-3">
      <button
        onClick={generateVoiceover}
        disabled={!pdfFile || isGenerating}
        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
      >
        {isGenerating ? 'Generating...' : '✨ Generate Voiceover'}
      </button>

      {slideText && (
        <div className="bg-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowExtractedText(!showExtractedText)}
            className="w-full py-2 px-3 flex items-center justify-between text-xs text-gray-400 font-mono hover:bg-gray-600 transition-colors"
          >
            <span>Extracted Text</span>
            <span>{showExtractedText ? '▼' : '▶'}</span>
          </button>
          {showExtractedText && (
            <div className="p-3 max-h-48 overflow-y-auto border-t border-gray-600">
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{slideText}</p>
            </div>
          )}
        </div>
      )}

      {generatedScript && (
        <div className="flex-1 bg-gray-700 rounded-lg p-4 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-2">Generated Script:</p>
          <p className="text-sm text-gray-300 leading-relaxed">{generatedScript}</p>
        </div>
      )}
    </div>
  )
}
