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

    setCurrentPage(newPage)

    // Check if we have cached content/script for this page
    if (scriptCache[newPage]) {
      setGeneratedScript(scriptCache[newPage])
      // Still trigger auto-generation for audio if cached
      setAutoGenerateTrigger(prev => prev + 1)
    } else {
      // Clear previous script and trigger auto-generation
      setGeneratedScript('')
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
    <div className="w-full h-full bg-gray-900 text-white flex">
      {/* Control Panel - Left Side */}
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

      {/* Slide Viewer - Right Side */}
      <SlideViewer
        pdfFile={pdfFile}
        currentPage={currentPage}
        setTotalPages={setTotalPages}
      />
    </div>
  )
}

export default App
