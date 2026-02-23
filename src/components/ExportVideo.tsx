import { getKey } from '../utils/apiKeys'
import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Muxer, ArrayBufferTarget } from 'webm-muxer'
import { detectPresentationLanguage, getSlidesToAnalyze } from '../utils/languageDetection'
import type { PresentationLanguage } from '../utils/languageDetection'

interface ExportVideoProps {
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
  isExporting: boolean
  setIsExporting: (exporting: boolean) => void
  presentationLanguage: 'dutch' | 'english' | null
  setPresentationLanguage: (language: 'dutch' | 'english' | null) => void
}

export default function ExportVideo({
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
  isExporting,
  setIsExporting,
  presentationLanguage,
  setPresentationLanguage,
}: ExportVideoProps) {
  const [progress, setProgress] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries = 5,
    baseDelay = 2000
  ): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        if (attempt === maxRetries - 1) throw error
        const delay = baseDelay * Math.pow(2, attempt)
        console.error(`[Retry] ❌ Attempt ${attempt + 1}/${maxRetries} failed`)
        console.error(`[Retry] Error type: ${error.constructor?.name || 'Unknown'}`)
        console.error(`[Retry] Error message: ${error.message || 'No message'}`)
        console.error(`[Retry] Full error:`, error)
        console.log(`[Retry] ⏳ Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
    throw new Error('Max retries exceeded')
  }


  const extractContentForPage = async (pageNumber: number): Promise<string> => {
    if (!pdfFile) return ''

    return retryWithBackoff(async () => {
      return new Promise<string>((resolve, reject) => {
        const fileReader = new FileReader()
        fileReader.onload = async (e) => {
          try {
            const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)
            const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
            const page = await pdf.getPage(pageNumber)
            const viewport = page.getViewport({ scale: 2.0 })
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')

            if (!context) {
              reject(new Error('Canvas context not available'))
              return
            }

            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvasContext: context, viewport: viewport }).promise
            const imageDataUrl = canvas.toDataURL('image/png')

            console.log(`[Extract] Slide ${pageNumber} image size: ${Math.round(imageDataUrl.length / 1024)}KB, dimensions: ${canvas.width}x${canvas.height}`)

            const endpoint = getKey('OPENAI_ENDPOINT')
            const apiKey = getKey('OPENAI_KEY')
            const model = getKey('OPENAI_MODEL')
            const apiVersion = getKey('API_VERSION')

            if (!endpoint || !apiKey) {
              reject(new Error('Azure OpenAI not configured'))
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
                  messages: [{
                    role: 'user',
                    content: [{
                      type: 'text',
                      text: 'Extract ALL visible text from this presentation slide.'
                    }, {
                      type: 'image_url',
                      image_url: { url: imageDataUrl }
                    }]
                  }],
                  max_tokens: 2000,
                  temperature: 0.1
                })
              }
            )

            if (!response.ok) {
              const errorText = await response.text()
              console.error(`[Extract] ❌ API error for slide ${pageNumber}:`)
              console.error(`[Extract] Status: ${response.status}`)
              console.error(`[Extract] Response: ${errorText}`)
              reject(new Error(`Extraction failed: ${response.status} - ${errorText}`))
              return
            }

            const data = await response.json()

            // Check for content filtering
            if (data.choices?.[0]?.finish_reason === 'content_filter') {
              const filterResults = data.choices[0]?.content_filter_results
              console.warn(`[Extract] ⚠️ Content filtered by Azure safety filters for slide ${pageNumber}`)
              console.warn(`[Extract] Filter categories:`, filterResults)

              // Use PDF text extraction as fallback
              console.log(`[Extract] Attempting PDF text extraction fallback for slide ${pageNumber}`)
              try {
                const textContent = await page.getTextContent()
                const fallbackText = textContent.items
                  .map((item: any) => item.str)
                  .join(' ')
                  .trim()

                if (fallbackText) {
                  console.log(`[Extract] ✓ Extracted ${fallbackText.length} characters via PDF text fallback`)
                  resolve(fallbackText)
                  return
                } else {
                  console.error(`[Extract] ❌ No PDF text available for filtered slide ${pageNumber}`)
                  reject(new Error(`Content filtered (${Object.keys(filterResults || {}).filter(k => filterResults[k]?.filtered).join(', ')}) and no PDF text available`))
                  return
                }
              } catch (fallbackError) {
                console.error(`[Extract] ❌ PDF text extraction fallback failed:`, fallbackError)
                reject(new Error(`Content filtered and fallback extraction failed: ${fallbackError}`))
                return
              }
            }

            const content = data.choices[0]?.message?.content

            // Log if content is empty string vs undefined/null
            if (!content || content.trim() === '') {
              console.error(`[Extract] ❌ Empty content in API response for slide ${pageNumber}`)
              console.error(`[Extract] Content value:`, JSON.stringify(content))
              console.error(`[Extract] Content type:`, typeof content)
              console.error(`[Extract] Finish reason:`, data.choices?.[0]?.finish_reason)
              console.error(`[Extract] Full response:`, JSON.stringify(data, null, 2))
              reject(new Error(`No content returned from API (finish_reason: ${data.choices?.[0]?.finish_reason})`))
              return
            }

            console.log(`[Extract] ✓ Extracted ${content.length} characters from slide ${pageNumber}`)
            resolve(content)
          } catch (error) {
            console.error(`[Extract] Error for slide ${pageNumber}:`, error)
            reject(error)
          }
        }

        fileReader.onerror = () => reject(new Error('FileReader error'))
        fileReader.readAsArrayBuffer(pdfFile)
      })
    })
  }

  const generateScriptForSlide = async (
    pageNumber: number,
    content: string,
    history: Record<number, string>,
    total: number
  ): Promise<string> => {
    return retryWithBackoff(async () => {
      const endpoint = getKey('OPENAI_ENDPOINT')
      const apiKey = getKey('OPENAI_KEY')
      const model = getKey('OPENAI_MODEL')
      const apiVersion = getKey('API_VERSION')

      if (!endpoint || !apiKey) {
        throw new Error('Azure OpenAI not configured')
      }

      const previousContext = Object.entries(history)
        .filter(([page]) => parseInt(page) < pageNumber)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .slice(-3)
        .map(([page, script]) => `Slide ${page}: ${script}`)
        .join('\n')

      const contextPrompt = pageNumber === 1
        ? `This is slide 1 of ${total}. Establish the presentation theme.`
        : `This is slide ${pageNumber} of ${total}.\n\nPrevious slides:\n${previousContext}\n\nContinue the flow.`

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
                content: 'You are a presenter. Output ONLY spoken words, no stage directions.'
              },
              {
                role: 'user',
                content: `${contextPrompt}\n\nSlide content: "${content}"\n\nCreate a 2-3 sentence presenter script.`
              }
            ],
            max_tokens: 500,
            temperature: 0.7
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Script] API error for slide ${pageNumber}:`, response.status, errorText)
        throw new Error(`Script generation failed: ${response.status}`)
      }

      const data = await response.json()
      const script = data.choices[0]?.message?.content
      if (!script) {
        throw new Error('No script returned from API')
      }
      return script
    })
  }

  const generateAudioForScript = async (script: string, exportLanguage: PresentationLanguage): Promise<Blob> => {
    return retryWithBackoff(async () => {
      const isDutch = exportLanguage === 'dutch'
      console.log(`[Export] Generating audio in ${isDutch ? 'Dutch (ElevenLabs)' : 'English (Deepgram)'}`)

      if (isDutch) {
        const elevenlabsKey = getKey('ELEVENLABS_API_KEY')
        const voiceId = getKey('ELEVENLABS_DUTCH_VOICE_ID')

        if (!elevenlabsKey || !voiceId) {
          throw new Error('ElevenLabs not configured for Dutch audio')
        }

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

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Audio] ElevenLabs error:', response.status, errorText)
          throw new Error(`ElevenLabs audio generation failed: ${response.status}`)
        }
        return await response.blob()
      } else {
        const deepgramKey = getKey('DEEPGRAM_API_KEY')

        if (!deepgramKey || deepgramKey === 'your_deepgram_api_key_here') {
          throw new Error('Deepgram not configured for English audio')
        }

        const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-hermes-en', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: script }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Audio] Deepgram error:', response.status, errorText)
          throw new Error(`Deepgram audio generation failed: ${response.status}`)
        }
        return await response.blob()
      }
    })
  }

  const renderSlideToImage = async (pageNumber: number): Promise<Blob> => {
    if (!pdfFile) throw new Error('No PDF file')

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

      fileReader.readAsArrayBuffer(pdfFile)
    })
  }

  const getAudioDuration = async (audioBlob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration)
        URL.revokeObjectURL(audio.src)
      })
    })
  }

  const handleCancel = () => {
    setIsExporting(false)
    setProgress('')
    setCurrentSlide(0)
  }

  const handleExport = async () => {
    if (!pdfFile || totalPages === 0) {
      alert('Please upload a PDF first')
      return
    }

    setIsExporting(true)
    setCurrentSlide(0)

    try {
      setProgress('Preparing export...')
      console.log('[Export] Starting MP4 export')

      // Wait for any in-flight prefetch operations to complete
      // This needs to be long enough for OpenAI API calls to finish (can take 5-15s per slide)
      // With 2 slides being prefetched (content + script + audio), we need substantial time
      console.log('[Export] Waiting 20 seconds for prefetch operations to complete...')
      console.log('[Export] Current cache status:')
      console.log('[Export] - Content cache pages:', Object.keys(contentCache).join(', ') || 'none')
      console.log('[Export] - Script cache pages:', Object.keys(scriptCache).join(', ') || 'none')
      console.log('[Export] - Audio cache pages:', Object.keys(audioCache).join(', ') || 'none')
      await sleep(20000)
      console.log('[Export] Wait complete. Final cache status:')
      console.log('[Export] - Content cache pages:', Object.keys(contentCache).join(', ') || 'none')
      console.log('[Export] - Script cache pages:', Object.keys(scriptCache).join(', ') || 'none')
      console.log('[Export] - Audio cache pages:', Object.keys(audioCache).join(', ') || 'none')

      // Determine presentation language if not already set
      let exportLanguage: PresentationLanguage = presentationLanguage || 'dutch' // default to dutch
      if (!presentationLanguage) {
        console.log('[Export] Presentation language not yet determined, analyzing scripts...')
        const scriptsToAnalyze: string[] = []
        const slidesToCheck = Math.min(getSlidesToAnalyze(totalPages), totalPages)

        for (let i = 1; i <= slidesToCheck; i++) {
          if (scriptCache[i]) {
            scriptsToAnalyze.push(scriptCache[i])
          }
        }

        if (scriptsToAnalyze.length > 0) {
          exportLanguage = detectPresentationLanguage(scriptsToAnalyze)
          setPresentationLanguage(exportLanguage)
          console.log(`[Export] ✓ Detected presentation language: ${exportLanguage.toUpperCase()}`)
        } else {
          console.log('[Export] No cached scripts available, will detect language from first generated script')
        }
      }

      const slideData: Array<{
        slideImage: Blob
        audioBlob: Blob
        duration: number
      }> = []

      const workingHistory = { ...scriptHistory }
      const failedSlides: number[] = []

      // Process each slide
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setCurrentSlide(pageNum)
        console.log(`[Export] Processing slide ${pageNum}/${totalPages}`)

        try {
          // Extract content
          setProgress(`Slide ${pageNum}/${totalPages}: Extracting content...`)
          let content = contentCache[pageNum]
          if (!content) {
            console.log(`[Export] Extracting content for slide ${pageNum}`)
            content = await extractContentForPage(pageNum)
            setContentCache(prev => ({ ...prev, [pageNum]: content }))
            console.log(`[Export] ✓ Content extracted for slide ${pageNum}`)
          } else {
            console.log(`[Export] ✓ Using cached content for slide ${pageNum}`)
          }

          // Delay after content extraction to avoid rate limiting
          await sleep(1000)

          // Generate script
          setProgress(`Slide ${pageNum}/${totalPages}: Generating script...`)
          let script = scriptCache[pageNum]
          if (!script) {
            console.log(`[Export] Generating script for slide ${pageNum}`)
            script = await generateScriptForSlide(pageNum, content, workingHistory, totalPages)
            setScriptCache(prev => ({ ...prev, [pageNum]: script }))
            console.log(`[Export] ✓ Script generated for slide ${pageNum}`)

            // Detect language from first script if not already determined
            if (!presentationLanguage && pageNum === 1) {
              exportLanguage = detectPresentationLanguage([script])
              setPresentationLanguage(exportLanguage)
              console.log(`[Export] ✓ Language detected from first script: ${exportLanguage.toUpperCase()}`)
            }
          } else {
            console.log(`[Export] ✓ Using cached script for slide ${pageNum}`)
          }
          workingHistory[pageNum] = script

          // Delay after script generation to avoid rate limiting
          await sleep(1000)

          // Generate audio
          setProgress(`Slide ${pageNum}/${totalPages}: Generating audio...`)
          let audioBlob: Blob | null = null
          if (audioCache[pageNum]) {
            try {
              const response = await fetch(audioCache[pageNum])
              audioBlob = await response.blob()
              console.log(`[Export] ✓ Using cached audio for slide ${pageNum}`)
            } catch (err) {
              console.log(`[Export] Cached audio fetch failed for slide ${pageNum}, regenerating...`)
              audioBlob = null
            }
          }

          if (!audioBlob) {
            console.log(`[Export] Generating audio for slide ${pageNum}`)
            audioBlob = await generateAudioForScript(script, exportLanguage)
            const audioUrl = URL.createObjectURL(audioBlob)
            setAudioCache(prev => ({ ...prev, [pageNum]: audioUrl }))
            console.log(`[Export] ✓ Audio generated for slide ${pageNum}`)
          }

          // Render slide image
          setProgress(`Slide ${pageNum}/${totalPages}: Rendering slide...`)
          console.log(`[Export] Rendering slide ${pageNum}`)
          const slideImage = await renderSlideToImage(pageNum)
          const duration = await getAudioDuration(audioBlob)
          console.log(`[Export] ✓ Slide ${pageNum} rendered (duration: ${duration.toFixed(2)}s)`)

          slideData.push({ slideImage, audioBlob, duration })

          // Delay to avoid rate limiting (1.5s between slides)
          if (pageNum < totalPages) {
            console.log(`[Export] Waiting 1.5s before next slide...`)
            await sleep(1500)
          }
        } catch (error: any) {
          console.error(`[Export] ✗ Failed to process slide ${pageNum}:`, error.message)
          failedSlides.push(pageNum)

          // Longer delay after error (3s)
          if (pageNum < totalPages) {
            console.log(`[Export] Error occurred, waiting 3s before next slide...`)
            await sleep(3000)
          }
        }
      }

      if (slideData.length === 0) {
        throw new Error('No slides could be processed')
      }

      setProgress('Creating video...')
      console.log('[Export] Creating WebM video')

      // Create WebM using webm-muxer with proper encoders
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'V_VP9',
          width: 1920,
          height: 1080,
        },
        audio: {
          codec: 'A_OPUS',
          sampleRate: 48000,
          numberOfChannels: 1,
        },
        fastStart: false,
      })

      // Create video encoder
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta)
        },
        error: (e) => console.error('Video encoder error:', e)
      })

      videoEncoder.configure({
        codec: 'vp09.00.10.08',
        width: 1920,
        height: 1080,
        bitrate: 2_000_000,
        framerate: 30,
      })

      // Create audio encoder
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          muxer.addAudioChunk(chunk, meta)
        },
        error: (e) => console.error('Audio encoder error:', e)
      })

      audioEncoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 1,
        bitrate: 64000,
      })

      let videoFrameCount = 0
      const fps = 30

      for (let i = 0; i < slideData.length; i++) {
        const { slideImage, audioBlob, duration } = slideData[i]
        setProgress(`Encoding slide ${i + 1}/${slideData.length}...`)

        // Create video frames from slide image
        const imageBitmap = await createImageBitmap(slideImage)
        const canvas = new OffscreenCanvas(1920, 1080)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 1920, 1080)
        ctx.drawImage(imageBitmap, 0, 0, 1920, 1080)

        // Encode video frames (30 fps for duration)
        const frameCount = Math.ceil(duration * fps)
        for (let frame = 0; frame < frameCount; frame++) {
          const videoFrame = new VideoFrame(canvas, {
            timestamp: (videoFrameCount / fps) * 1000000,
          })
          videoEncoder.encode(videoFrame, { keyFrame: frame === 0 })
          videoFrame.close()
          videoFrameCount++
        }

        // Encode audio
        const audioContext = new AudioContext({ sampleRate: 48000 })
        const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer())
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: 48000,
          numberOfFrames: audioBuffer.length,
          numberOfChannels: 1,
          timestamp: i * duration * 1000000,
          data: audioBuffer.getChannelData(0),
        })
        audioEncoder.encode(audioData)
        audioData.close()
      }

      // Flush encoders
      await videoEncoder.flush()
      await audioEncoder.flush()
      videoEncoder.close()
      audioEncoder.close()

      muxer.finalize()
      const buffer = muxer.target.buffer

      setProgress('Downloading...')
      const blob = new Blob([buffer], { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presentation-${new Date().toISOString().slice(0, 10)}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('[Export] Export complete!')

      if (failedSlides.length > 0) {
        alert(
          `Video exported successfully!\n\n` +
          `Included: ${slideData.length} slides\n` +
          `Skipped: ${failedSlides.length} slides (${failedSlides.join(', ')})`
        )
      } else {
        alert(`Video exported successfully!\n\nAll ${totalPages} slides included.`)
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
            : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:scale-[1.02] shadow-lg hover:shadow-2xl hover:shadow-purple-500/40'
          }
        `}
      >
        {!isExporting && pdfFile && (
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundSize: '200% 200%', animation: 'gradient-shift 3s ease infinite' }}></div>
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
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span>Export as Video (WebM)</span>
            </>
          )}
        </div>
      </button>

      {isExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass rounded-xl p-6 max-w-md w-full mx-4 border border-purple-500/30 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Exporting Video</h2>
                  <p className="text-sm text-gray-400">Please wait...</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-300">{progress}</p>

                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 rounded-full"
                    style={{ width: `${totalPages > 0 ? (currentSlide / totalPages) * 100 : 0}%` }}
                  ></div>
                </div>

                <p className="text-xs text-gray-500 text-right">
                  Slide {currentSlide} of {totalPages}
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
