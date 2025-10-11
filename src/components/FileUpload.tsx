import { useRef } from 'react'

interface FileUploadProps {
  pdfFile: File | null
  setPdfFile: (file: File | null) => void
}

export default function FileUpload({ pdfFile, setPdfFile }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={handleClick}
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
      >
        {pdfFile ? 'Change PDF' : 'Upload PDF'}
      </button>

      {pdfFile && (
        <div className="text-sm text-gray-400 truncate">
          Loaded: {pdfFile.name}
        </div>
      )}
    </div>
  )
}
