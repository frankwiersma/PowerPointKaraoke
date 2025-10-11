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

  // Clean up when page changes (but not when script changes)
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
  }, [currentPage])

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
      console.warn('Deepgram API key not configured')
      return
    }

    // Prevent concurrent generation
    if (isGeneratingAudio) {
      console.log('Audio generation already in progress, skipping')
      return
    }

    const pageAtStart = currentPage
    setIsGeneratingAudio(true)

    // Stop any currently playing audio first
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch (e) {
        // Ignore errors from stopping old audio
      }
    }
    setIsPlaying(false)

    try {
      // Check if we have cached audio for this page
      let audioUrl = audioCache[pageAtStart]

      if (!audioUrl) {
        console.log(`Generating audio for page ${pageAtStart}`)
        // Generate new audio
        audioUrl = await generateAudio(script, pageAtStart)

        // Check if page changed during generation
        if (currentPageRef.current !== pageAtStart) {
          console.log('Page changed during audio generation, stopping playback')
          setIsGeneratingAudio(false)
          return
        }

        if (!audioUrl) {
          console.log('Audio generation returned null (likely aborted or page changed)')
          setIsGeneratingAudio(false)
          return
        }

        // Cache the audio URL
        setAudioCache(prev => ({ ...prev, [pageAtStart]: audioUrl! }))
        console.log(`Audio cached for page ${pageAtStart}`)
      } else {
        console.log(`Using cached audio for page ${pageAtStart}`)
      }

      // Final check before playing
      if (currentPageRef.current !== pageAtStart) {
        console.log('Page changed before playback, aborting')
        setIsGeneratingAudio(false)
        return
      }

      // Revoke old URL if exists
      if (audioUrlRef.current && audioUrlRef.current !== audioUrl) {
        URL.revokeObjectURL(audioUrlRef.current)
      }

      audioUrlRef.current = audioUrl

      // Create new audio element
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        console.log('Audio playback ended')
        setIsPlaying(false)
      }
      audio.onerror = (e) => {
        console.error('Audio playback error:', e)
        setIsPlaying(false)
      }

      // Wait a tiny bit to ensure previous audio is fully stopped
      await new Promise(resolve => setTimeout(resolve, 100))

      // Play the audio
      console.log(`Playing audio for page ${pageAtStart}`)
      await audio.play()
      setIsPlaying(true)
    } catch (error: any) {
      // Only show error if we're still on the same page and it's not an abort
      if (currentPageRef.current === pageAtStart && error.name !== 'AbortError') {
        console.error('Error in generateAndPlayAudio:', error)
        // Don't show alert for play() interrupted errors
        if (!error.message?.includes('interrupted')) {
          const errorMsg = error?.message || 'Unknown error'
          console.error(`Failed to generate/play audio: ${errorMsg}`)
        }
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
    if (autoPlayTrigger > 0 && script && !isGeneratingAudio && !isPlaying) {
      console.log('Auto-play triggered for page:', currentPage)
      // Small delay to ensure script display has updated
      const timeoutId = setTimeout(() => {
        if (!isGeneratingAudio && !isPlaying) {
          generateAndPlayAudio()
        }
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [autoPlayTrigger])

  // Stop audio when stopAudioTrigger changes
  useEffect(() => {
    if (stopAudioTrigger > 0) {
      console.log('Stop audio triggered')
      // Abort any ongoing generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Stop playback
      if (audioRef.current) {
        try {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        } catch (e) {
          // Ignore errors
        }
      }
      setIsPlaying(false)
      setIsGeneratingAudio(false)
    }
  }, [stopAudioTrigger])

  return (
    <div className="space-y-2" style={{ padding: '0!important', margin: '0!important' }}>
      {/* Audio Player Card */}
      <div className="glass rounded-lg overflow-hidden border border-gray-700/50 shadow-xl" style={{ padding: '0!important', margin: '0!important' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-3 py-2 border-b border-gray-700/50" style={{ margin: '0!important' }}>
          <div className="flex items-center space-x-2" style={{ padding: '0!important', margin: '0!important' }}>
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
            </div>
            <div className="flex-1" style={{ padding: '0!important', margin: '0!important' }}>
              <h3 className="text-xs font-semibold text-white">Audio Playback</h3>
              <p className="text-xs text-gray-400">
                {isGeneratingAudio ? 'Generating...' : isPlaying ? 'Now playing' : 'Ready to play'}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-3" style={{ margin: '0!important' }}>
          {/* Waveform Visualization Placeholder */}
          {isGeneratingAudio && (
            <div className="mb-2 wave-container h-12 bg-gray-800/50 rounded-lg flex items-center justify-center" style={{ padding: '0.5rem!important', margin: '0 0 0.5rem 0!important' }}>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
            </div>
          )}

          {/* Button Group */}
          <div className="flex gap-2" style={{ padding: '0!important', margin: '0!important' }}>
            {/* Play/Pause Button */}
            <button
              onClick={handlePlay}
              disabled={isGeneratingAudio}
              className={`
                flex-1 group relative overflow-hidden rounded-lg py-2 px-3 font-semibold text-sm
                transition-all duration-300 transform
                ${isGeneratingAudio
                  ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                  : isPlaying
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:scale-[1.02] shadow-lg hover:shadow-xl hover:shadow-orange-500/30'
                    : 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:scale-[1.02] shadow-lg hover:shadow-xl hover:shadow-green-500/30'
                }
              `}
            >
              {/* Pulse effect when playing */}
              {isPlaying && (
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              )}

              <div className="relative flex items-center justify-center space-x-1" style={{ padding: '0!important', margin: '0!important' }}>
                {isGeneratingAudio ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : isPlaying ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    <span>Play</span>
                  </>
                )}
              </div>
            </button>

            {/* Stop Button */}
            <button
              onClick={handleStop}
              disabled={!isPlaying && !audioRef.current}
              className={`
                flex-1 group relative overflow-hidden rounded-lg py-2 px-3 font-semibold text-sm
                transition-all duration-300 transform
                ${!isPlaying && !audioRef.current
                  ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:scale-[1.02] shadow-lg hover:shadow-xl hover:shadow-red-500/30'
                }
              `}
            >
              <div className="relative flex items-center justify-center space-x-1" style={{ padding: '0!important', margin: '0!important' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                <span>Stop</span>
              </div>
            </button>
          </div>

          {/* Status Indicator */}
          {(isPlaying || isGeneratingAudio) && (
            <div
              className="mt-2 flex items-center justify-center space-x-2 text-xs text-gray-400"
              style={{ padding: '0!important', margin: '0.5rem 0 0 0!important', animation: 'fadeIn 0.3s ease-out' }}
            >
              <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-purple-400 animate-pulse'}`}></div>
              <span>{isPlaying ? 'Audio playing' : 'Generating audio'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
