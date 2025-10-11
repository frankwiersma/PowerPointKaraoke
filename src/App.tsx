import { useState } from 'react'
import './App.css'
import ControlPanel from './components/ControlPanel'
import SlideViewer from './components/SlideViewer'

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [generatedScript, setGeneratedScript] = useState('')
  const [autoGenerateTrigger, setAutoGenerateTrigger] = useState(0)
  const [presentationContext, setPresentationContext] = useState<string>('')
  const [scriptHistory, setScriptHistory] = useState<Record<number, string>>({})
  const [stopAudioTrigger, setStopAudioTrigger] = useState(0)

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
    setPdfFile(file)
    // Reset everything when a new file is loaded
    setCurrentPage(1)
    setGeneratedScript('')
    setPresentationContext('')
    setScriptHistory({})
    setContentCache({})
    setScriptCache({})
    setAudioCache({})
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
          scriptHistory={scriptHistory}
          stopAudioTrigger={stopAudioTrigger}
          contentCache={contentCache}
          setContentCache={setContentCache}
          scriptCache={scriptCache}
          setScriptCache={setScriptCache}
          audioCache={audioCache}
          setAudioCache={setAudioCache}
        />
      </div>

      {/* Slide Viewer + Script - Right Side */}
      <div className="relative z-10 flex-1 min-w-0 overflow-hidden">
        <SlideViewer
          pdfFile={pdfFile}
          currentPage={currentPage}
          setTotalPages={setTotalPages}
          generatedScript={generatedScript}
        />
      </div>
    </div>
  )
}

export default App
