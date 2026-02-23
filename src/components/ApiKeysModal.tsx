import { useState, useEffect } from 'react'
import { getKey, setKey, clearKeys, type ApiKeyName } from '../utils/apiKeys'

interface Props {
  open: boolean
  onClose: () => void
  /** If true, this is the first-run setup — don't show a close button */
  required?: boolean
}

interface FieldDef {
  key: ApiKeyName
  label: string
  placeholder: string
  hint: string
  link: string
  linkLabel: string
  required: boolean
}

const FIELDS: FieldDef[] = [
  {
    key: 'OPENAI_ENDPOINT',
    label: 'Azure OpenAI Endpoint',
    placeholder: 'https://your-instance.openai.azure.com/',
    hint: 'Required for slide analysis and script generation.',
    link: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
    linkLabel: 'Azure OpenAI →',
    required: true,
  },
  {
    key: 'OPENAI_KEY',
    label: 'Azure OpenAI API Key',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    hint: 'Your Azure OpenAI resource key.',
    link: 'https://portal.azure.com',
    linkLabel: 'Azure Portal →',
    required: true,
  },
  {
    key: 'OPENAI_MODEL',
    label: 'Azure OpenAI Deployment Name',
    placeholder: 'gpt-4o',
    hint: 'Name of your GPT-4o deployment. Default: gpt-4o',
    link: '',
    linkLabel: '',
    required: false,
  },
  {
    key: 'API_VERSION',
    label: 'Azure API Version',
    placeholder: '2025-01-01-preview',
    hint: 'API version string. Default: 2025-01-01-preview',
    link: '',
    linkLabel: '',
    required: false,
  },
  {
    key: 'DEEPGRAM_API_KEY',
    label: 'Deepgram API Key',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    hint: 'Used for English text-to-speech. Required for English presentations.',
    link: 'https://console.deepgram.com/',
    linkLabel: 'Deepgram Console →',
    required: false,
  },
  {
    key: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs API Key',
    placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    hint: 'Used for Dutch text-to-speech. Required for Dutch presentations.',
    link: 'https://elevenlabs.io/',
    linkLabel: 'ElevenLabs →',
    required: false,
  },
  {
    key: 'ELEVENLABS_DUTCH_VOICE_ID',
    label: 'ElevenLabs Voice ID (optional)',
    placeholder: 'nPczCjzI2devNBz1zQrb',
    hint: 'Override the Dutch voice. Leave blank for default.',
    link: 'https://elevenlabs.io/voice-library',
    linkLabel: 'Voice Library →',
    required: false,
  },
  {
    key: 'GEMINI_API_KEY',
    label: 'Google Gemini API Key (optional)',
    placeholder: 'AIza...',
    hint: 'Fallback AI provider if Azure OpenAI is unavailable.',
    link: 'https://aistudio.google.com/apikey',
    linkLabel: 'Google AI Studio →',
    required: false,
  },
]

export default function ApiKeysModal({ open, onClose, required = false }: Props) {
  const [values, setValues] = useState<Record<ApiKeyName, string>>({} as Record<ApiKeyName, string>)
  const [saved, setSaved] = useState(false)
  const [showValues, setShowValues] = useState<Record<ApiKeyName, boolean>>({} as Record<ApiKeyName, boolean>)

  useEffect(() => {
    if (open) {
      const initial = {} as Record<ApiKeyName, string>
      for (const f of FIELDS) {
        initial[f.key] = getKey(f.key)
      }
      setValues(initial)
      setSaved(false)
    }
  }, [open])

  if (!open) return null

  const handleSave = () => {
    for (const f of FIELDS) {
      setKey(f.key, values[f.key] ?? '')
    }
    setSaved(true)
    setTimeout(() => {
      onClose()
    }, 600)
  }

  const handleClear = () => {
    clearKeys()
    const cleared = {} as Record<ApiKeyName, string>
    for (const f of FIELDS) cleared[f.key] = ''
    setValues(cleared)
  }

  const canSave = !!(
    (values['OPENAI_ENDPOINT'] ?? '').trim() &&
    (values['OPENAI_KEY'] ?? '').trim() &&
    ((values['DEEPGRAM_API_KEY'] ?? '').trim() || (values['ELEVENLABS_API_KEY'] ?? '').trim())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={required ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-800/95 backdrop-blur px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">🔑 API Keys</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Keys are stored only in your browser — never sent to a server.
            </p>
          </div>
          {!required && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-5">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-200">
                  {field.label}
                  {field.required && <span className="ml-1 text-pink-400">*</span>}
                </label>
                {field.link && (
                  <a
                    href={field.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 transition"
                  >
                    {field.linkLabel}
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showValues[field.key] ? 'text' : 'password'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowValues((sv) => ({ ...sv, [field.key]: !sv[field.key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  tabIndex={-1}
                >
                  {showValues[field.key] ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">{field.hint}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-white/10 bg-slate-900/95 backdrop-blur px-6 py-4">
          <button
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-red-400 transition"
          >
            Clear all keys
          </button>
          <div className="flex items-center gap-3">
            {!required && (
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                saved
                  ? 'bg-green-600 text-white'
                  : canSave
                  ? 'bg-purple-600 text-white hover:bg-purple-500'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500'
              }`}
            >
              {saved ? '✓ Saved!' : 'Save Keys'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
