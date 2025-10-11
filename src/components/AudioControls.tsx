import { useState, useRef, useEffect } from 'react'

interface AudioControlsProps {
  script: string
  autoPlayTrigger: number
  stopAudioTrigger: number
  audioCache: Record<number, string>
  setAudioCache: (cache: Record<number, string>) => void
  currentPage: number
}

export default function AudioControls({ script, autoPlayTrigger, stopAudioTrigger, audioCache, setAudioCache, currentPage }: AudioControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentPageRef = useRef<number>(currentPage)

  // Track current page changes
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  // Clean up when script or page changes
  useEffect(() => {
    return () => {
      // Abort any ongoing audio generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Stop audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setIsPlaying(false)
      setIsGeneratingAudio(false)
    }
  }, [script, currentPage])

  const generateAudio = async (text: string, pageNumber: number): Promise<string | null> => {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
    if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
      return null
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-hermes-en', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Deepgram API error response:', errorText)
        throw new Error(`Deepgram API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // Check if we're still on the same page
      if (currentPageRef.current !== pageNumber) {
        console.log('Page changed during audio generation, aborting')
        return null
      }

      const audioBlob = await response.blob()
      console.log('Audio blob size:', audioBlob.size, 'bytes')

      // Double-check page hasn't changed
      if (currentPageRef.current !== pageNumber) {
        console.log('Page changed after receiving audio, aborting')
        return null
      }

      const audioUrl = URL.createObjectURL(audioBlob)
      console.log('Generated audio URL:', audioUrl)
      return audioUrl
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Audio generation aborted')
        return null
      }
      console.error('Error generating audio:', error)
      console.error('Error details:', error?.message)
      return null
    }
  }

  const generateAndPlayAudio = async () => {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
    if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
      alert('Please add your Deepgram API key to the .env file')
      return
    }

    const pageAtStart = currentPage
    setIsGeneratingAudio(true)

    try {
      // Check if we have cached audio for this page
      let audioUrl = audioCache[pageAtStart]

      if (!audioUrl) {
        // Generate new audio
        audioUrl = await generateAudio(script, pageAtStart)

        // Check if page changed during generation
        if (currentPageRef.current !== pageAtStart) {
          console.log('Page changed during audio generation, stopping playback')
          return
        }

        if (!audioUrl) {
          throw new Error('Failed to generate audio')
        }

        // Cache the audio URL
        setAudioCache(prev => ({ ...prev, [pageAtStart]: audioUrl! }))
      }

      // Final check before playing
      if (currentPageRef.current !== pageAtStart) {
        console.log('Page changed before playback, aborting')
        return
      }

      // Revoke old URL if exists
      if (audioUrlRef.current && audioUrlRef.current !== audioUrl) {
        URL.revokeObjectURL(audioUrlRef.current)
      }

      audioUrlRef.current = audioUrl

      // Create and play audio
      if (audioRef.current) {
        audioRef.current.pause()
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => {
        setIsPlaying(false)
        alert('Error playing audio')
      }

      await audio.play()
      setIsPlaying(true)
    } catch (error: any) {
      // Only show error if we're still on the same page
      if (currentPageRef.current === pageAtStart) {
        console.error('Error generating audio:', error)
        const errorMsg = error?.message || 'Unknown error'
        alert(`Failed to generate audio with Deepgram.\n\nError: ${errorMsg}\n\nCheck console for details.`)
      }
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const handlePlay = async () => {
    if (audioRef.current && audioUrlRef.current) {
      // Audio already generated, just play/pause
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        await audioRef.current.play()
        setIsPlaying(true)
      }
    } else {
      // Generate audio first
      await generateAndPlayAudio()
    }
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  // Auto-play when autoPlayTrigger changes
  useEffect(() => {
    if (autoPlayTrigger > 0 && script) {
      generateAndPlayAudio()
    }
  }, [autoPlayTrigger])

  // Stop audio when stopAudioTrigger changes
  useEffect(() => {
    if (stopAudioTrigger > 0 && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }, [stopAudioTrigger])

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          onClick={handlePlay}
          disabled={isGeneratingAudio}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {isGeneratingAudio ? 'Generating...' : isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={handleStop}
          disabled={!isPlaying && !audioRef.current}
          className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  )
}
