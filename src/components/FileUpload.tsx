import { useRef, useState } from 'react'

interface FileUploadProps {
  pdfFile: File | null
  setPdfFile: (file: File | null) => void
}

export default function FileUpload({ pdfFile, setPdfFile }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
    } else {
      alert('Please select a valid PDF file')
      e.target.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
    } else {
      alert('Please drop a valid PDF file')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-4" style={{ padding: '0!important', margin: '0!important' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative group cursor-pointer rounded-xl transition-all duration-300
          ${isDragging
            ? 'glass border-2 border-purple-500 scale-[1.02] shadow-2xl shadow-purple-500/30'
            : 'glass-light border-2 border-dashed border-gray-600 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20'
          }
        `}
        style={{ padding: '1rem!important' }}
      >
        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="relative flex flex-col items-center justify-center space-y-2" style={{ padding: '0!important', margin: '0!important' }}>
          {/* Icon */}
          <div className={`transition-all duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-105'}`}>
            <svg
              className="w-12 h-12 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {/* Text */}
          <div className="text-center space-y-1" style={{ padding: '0!important', margin: '0!important' }}>
            <p className="text-sm font-semibold text-white">
              {isDragging ? 'Drop your PDF here' : pdfFile ? 'Change PDF' : 'Upload PDF'}
            </p>
            <p className="text-xs text-gray-400">
              {isDragging ? 'Release to upload' : 'Drag & drop or click to browse'}
            </p>
          </div>

          {/* Supported Format Badge */}
          {!pdfFile && (
            <div className="inline-flex items-center px-2 py-1 rounded-full bg-slate-700/60 border border-purple-500/30">
              <svg className="w-3 h-3 text-green-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-gray-200">PDF only</span>
            </div>
          )}
        </div>
      </div>

      {/* File Info Card */}
      {pdfFile && (
        <div
          className="glass rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg"
          style={{
            padding: '0!important',
            margin: '0!important',
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div className="p-3" style={{ margin: '0!important' }}>
            <div className="flex items-start space-x-2" style={{ padding: '0!important', margin: '0!important' }}>
              {/* PDF Icon */}
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>

              {/* File Details */}
              <div className="flex-1 min-w-0" style={{ padding: '0!important', margin: '0!important' }}>
                <p className="text-xs font-semibold text-white truncate">
                  {pdfFile.name}
                </p>
                <div className="flex items-center space-x-2 mt-0.5" style={{ padding: '0!important', margin: '0!important' }}>
                  <span className="text-xs text-gray-300">
                    {formatFileSize(pdfFile.size)}
                  </span>
                </div>
              </div>

              {/* Success Badge */}
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
