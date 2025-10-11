import { useState } from 'react'
import FileUpload from './FileUpload'
import Navigation from './Navigation'
import ScriptDisplay from './ScriptDisplay'
import AudioControls from './AudioControls'

interface ControlPanelProps {
  pdfFile: File | null
  setPdfFile: (file: File | null) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  totalPages: number
  generatedScript: string
  setGeneratedScript: (script: string) => void
  autoGenerateTrigger: number
  presentationContext: string
  setPresentationContext: (context: string) => void
  scriptHistory: Record<number, string>
  stopAudioTrigger: number
  contentCache: Record<number, string>
  setContentCache: (cache: Record<number, string>) => void
  scriptCache: Record<number, string>
  setScriptCache: (cache: Record<number, string>) => void
  audioCache: Record<number, string>
  setAudioCache: (cache: Record<number, string>) => void
}

export default function ControlPanel({
  pdfFile,
  setPdfFile,
  currentPage,
  setCurrentPage,
  totalPages,
  generatedScript,
  setGeneratedScript,
  autoGenerateTrigger,
  presentationContext,
  setPresentationContext,
  scriptHistory,
  stopAudioTrigger,
  contentCache,
  setContentCache,
  scriptCache,
  setScriptCache,
  audioCache,
  setAudioCache,
}: ControlPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)

  return (
    <div className="w-80 h-full bg-gray-800 flex flex-col gap-4 border-r border-gray-700 overflow-y-auto shrink-0" style={{ padding: '1rem' }}>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-purple-400">PowerPoint Karaoke AI</h1>
        <p className="text-sm text-gray-400">
          Upload a presentation and let AI create a witty voiceover!
        </p>
      </div>

      {/* File Upload */}
      <FileUpload pdfFile={pdfFile} setPdfFile={setPdfFile} />

      {/* Navigation - only show when PDF is loaded */}
      {pdfFile && totalPages > 0 && (
        <Navigation
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
        />
      )}

      {/* Script Display */}
      <ScriptDisplay
        pdfFile={pdfFile}
        currentPage={currentPage}
        totalPages={totalPages}
        generatedScript={generatedScript}
        setGeneratedScript={setGeneratedScript}
        isGenerating={isGenerating}
        setIsGenerating={setIsGenerating}
        autoGenerateTrigger={autoGenerateTrigger}
        setAutoPlayTrigger={setAutoPlayTrigger}
        presentationContext={presentationContext}
        setPresentationContext={setPresentationContext}
        scriptHistory={scriptHistory}
        contentCache={contentCache}
        setContentCache={setContentCache}
        scriptCache={scriptCache}
        setScriptCache={setScriptCache}
        audioCache={audioCache}
        setAudioCache={setAudioCache}
      />

      {/* Audio Controls */}
      {generatedScript && (
        <AudioControls
          script={generatedScript}
          autoPlayTrigger={autoPlayTrigger}
          stopAudioTrigger={stopAudioTrigger}
          audioCache={audioCache}
          setAudioCache={setAudioCache}
          currentPage={currentPage}
        />
      )}
    </div>
  )
}
