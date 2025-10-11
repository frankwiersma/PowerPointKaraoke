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
    <div
      className="w-96 h-full border-r flex flex-col shadow-2xl"
      style={{
        padding: 0,
        margin: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(168, 85, 247, 0.2)'
      }}
    >
      {/* Sticky Header */}
      <div
        className="sticky top-0 z-10 border-b backdrop-blur-xl"
        style={{
          padding: '1rem',
          margin: 0,
          background: 'rgba(15, 23, 42, 0.9)',
          borderBottom: '1px solid rgba(168, 85, 247, 0.2)'
        }}
      >
        <div className="space-y-2">
          {/* Logo/Title with Gradient */}
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold gradient-text">
                PPT Karaoke AI
              </h1>
              <p className="text-xs text-gray-400 font-medium">
                AI-Powered Presentations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '1rem', margin: 0 }}>
        <div className="space-y-3">
          {/* File Upload Section */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
              <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Step 1: Upload
              </h2>
            </div>
            <FileUpload pdfFile={pdfFile} setPdfFile={setPdfFile} />
          </div>

          {/* Navigation - only show when PDF is loaded */}
          {pdfFile && totalPages > 0 && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-1 h-4 bg-gradient-to-b from-pink-500 to-orange-500 rounded-full"></div>
                <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Step 2: Navigate
                </h2>
              </div>
              <Navigation
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
              />
            </div>
          )}

          {/* Script Generation & Audio Section */}
          {pdfFile && totalPages > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-1 h-4 bg-gradient-to-b from-orange-500 to-purple-500 rounded-full"></div>
                <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Step 3: Generate & Play
                </h2>
              </div>

              <div className="space-y-3">
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
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="border-t backdrop-blur-xl"
        style={{
          padding: '0.75rem 1rem',
          margin: 0,
          background: 'rgba(15, 23, 42, 0.9)',
          borderTop: '1px solid rgba(168, 85, 247, 0.2)'
        }}
      >
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          <span>Powered by Azure OpenAI, ElevenLabs & Deepgram</span>
        </div>
      </div>
    </div>
  )
}
