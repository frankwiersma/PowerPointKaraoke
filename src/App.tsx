import { useState, useEffect } from 'react'
import './App.css'
import ControlPanel from './components/ControlPanel'
import SlideViewer from './components/SlideViewer'
import ApiKeysModal from './components/ApiKeysModal'
import { hasRequiredKeys } from './utils/apiKeys'

function App() {
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [keysConfigured, setKeysConfigured] = useState(true)

  useEffect(() => {
    setKeysConfigured(hasRequiredKeys())
  }, [])

  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [generatedScript, setGeneratedScript] = useState('')
  const [autoGenerateTrigger, setAutoGenerateTrigger] = useState(0)
  const [presentationContext, setPresentationContext] = useState<string>('')
  const [scriptHistory, setScriptHistory] = useState<Record<number, string>>({})
  const [stopAudioTrigger, setStopAudioTrigger] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [presentationLanguage, setPresentationLanguage] = useState<'dutch' | 'english' | null>(null)
  const [languageAnalyzedSlides, setLanguageAnalyzedSlides] = useState<number>(0)

  // Prefetch cache for next slide
  const [contentCache, setContentCache] = useState<Record<number, string>>({})
  const [scriptCache, setScriptCache] = useState<Record<number, string>>({})
  const [audioCache, setAudioCache] = useState<Record<number, string>>({})

  const handlePageChange = (newPage: number) => {
    // Stop current audio playback
    setStopAudioTrigger(prev => prev + 1)

    // Save current script to history before changing pages
    if (generatedScript && currentPage) {
      setScriptHistory(prev => ({ ...prev, [currentPage]: generatedScript }))
    }

    // Clear the script first to prevent showing old script with new slide
    setGeneratedScript('')

    setCurrentPage(newPage)

    // Check if we have cached content/script for this page
    if (scriptCache[newPage]) {
      // Use setTimeout to ensure the clear happens first
      setTimeout(() => {
        setGeneratedScript(scriptCache[newPage])
        // Still trigger auto-generation for audio if cached
        setAutoGenerateTrigger(prev => prev + 1)
      }, 50)
    } else {
      // Trigger auto-generation
      setAutoGenerateTrigger(prev => prev + 1)
    }
  }

  const handleFileChange = (file: File | null) => {
    // Stop any playing audio first
    setStopAudioTrigger(prev => prev + 1)

    // Clean up all cached audio blob URLs to prevent memory leaks
    setAudioCache(prevCache => {
      Object.values(prevCache).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
      return {}
    })

    // Reset all state when a new file is loaded
    setPdfFile(file)
    setCurrentPage(1)
    setTotalPages(0)
    setGeneratedScript('')
    setPresentationContext('')
    setPresentationLanguage(null)
    setLanguageAnalyzedSlides(0)
    setScriptHistory({})
    setContentCache({})
    setScriptCache({})

    // Trigger auto-generation for first slide
    if (file) {
      setAutoGenerateTrigger(prev => prev + 1)
    }
  }

  return (
    <div
      className="w-full h-full text-white flex relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
        margin: 0,
        padding: 0
      }}
    >
      {/* API Keys Modal — first run or manual open */}
      <ApiKeysModal
        open={showApiKeys || !keysConfigured}
        onClose={() => { setShowApiKeys(false); setKeysConfigured(hasRequiredKeys()) }}
        required={!keysConfigured}
      />

      {/* Settings button */}
      <button
        onClick={() => setShowApiKeys(true)}
        title="API Key Settings"
        className="absolute top-3 right-3 z-40 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>

      {/* Control Panel - Left Side */}
      <div className="relative z-10 shrink-0">
        <ControlPanel
          pdfFile={pdfFile}
          setPdfFile={handleFileChange}
          currentPage={currentPage}
          setCurrentPage={handlePageChange}
          totalPages={totalPages}
          generatedScript={generatedScript}
          setGeneratedScript={setGeneratedScript}
          autoGenerateTrigger={autoGenerateTrigger}
          presentationContext={presentationContext}
          setPresentationContext={setPresentationContext}
          presentationLanguage={presentationLanguage}
          setPresentationLanguage={setPresentationLanguage}
          languageAnalyzedSlides={languageAnalyzedSlides}
          setLanguageAnalyzedSlides={setLanguageAnalyzedSlides}
          scriptHistory={scriptHistory}
          stopAudioTrigger={stopAudioTrigger}
          contentCache={contentCache}
          setContentCache={setContentCache}
          scriptCache={scriptCache}
          setScriptCache={setScriptCache}
          audioCache={audioCache}
          setAudioCache={setAudioCache}
          isExporting={isExporting}
          setIsExporting={setIsExporting}
        />
      </div>

      {/* Slide Viewer + Script - Right Side */}
      <div className="relative z-10 flex-1 min-w-0 overflow-hidden">
        <SlideViewer
          pdfFile={pdfFile}
          currentPage={currentPage}
          setTotalPages={setTotalPages}
          generatedScript={generatedScript}
          setCurrentPage={handlePageChange}
          totalPages={totalPages}
        />
      </div>
    </div>
  )
}

export default App
