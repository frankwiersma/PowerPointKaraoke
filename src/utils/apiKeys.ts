/**
 * API Keys utility — reads from localStorage first, falls back to build-time env vars.
 * This allows users to bring their own keys without a server.
 */

const LS_PREFIX = 'pptkaraoke_key_'

export type ApiKeyName =
  | 'OPENAI_ENDPOINT'
  | 'OPENAI_KEY'
  | 'OPENAI_MODEL'
  | 'API_VERSION'
  | 'DEEPGRAM_API_KEY'
  | 'ELEVENLABS_API_KEY'
  | 'ELEVENLABS_DUTCH_VOICE_ID'
  | 'GEMINI_API_KEY'

const ENV_DEFAULTS: Record<ApiKeyName, string> = {
  OPENAI_ENDPOINT: import.meta.env.VITE_OPENAI_ENDPOINT ?? '',
  OPENAI_KEY: import.meta.env.VITE_OPENAI_KEY ?? '',
  OPENAI_MODEL: import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o',
  API_VERSION: import.meta.env.VITE_API_VERSION ?? '2025-01-01-preview',
  DEEPGRAM_API_KEY: import.meta.env.VITE_DEEPGRAM_API_KEY ?? '',
  ELEVENLABS_API_KEY: import.meta.env.VITE_ELEVENLABS_API_KEY ?? '',
  ELEVENLABS_DUTCH_VOICE_ID: import.meta.env.VITE_ELEVENLABS_DUTCH_VOICE_ID ?? 'nPczCjzI2devNBz1zQrb',
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY ?? '',
}

/** Get a key — localStorage takes priority over build-time env var */
export function getKey(name: ApiKeyName): string {
  return localStorage.getItem(LS_PREFIX + name) ?? ENV_DEFAULTS[name] ?? ''
}

/** Save a key to localStorage */
export function setKey(name: ApiKeyName, value: string): void {
  if (value.trim()) {
    localStorage.setItem(LS_PREFIX + name, value.trim())
  } else {
    localStorage.removeItem(LS_PREFIX + name)
  }
}

/** Get all stored keys (localStorage values only, not env defaults) */
export function getStoredKeys(): Partial<Record<ApiKeyName, string>> {
  const result: Partial<Record<ApiKeyName, string>> = {}
  const keyNames = Object.keys(ENV_DEFAULTS) as ApiKeyName[]
  for (const name of keyNames) {
    const val = localStorage.getItem(LS_PREFIX + name)
    if (val) result[name] = val
  }
  return result
}

/** Clear all stored keys from localStorage */
export function clearKeys(): void {
  const keyNames = Object.keys(ENV_DEFAULTS) as ApiKeyName[]
  for (const name of keyNames) {
    localStorage.removeItem(LS_PREFIX + name)
  }
}

/** Returns true if the minimum required keys are present */
export function hasRequiredKeys(): boolean {
  const azureEndpoint = getKey('OPENAI_ENDPOINT')
  const azureKey = getKey('OPENAI_KEY')
  const deepgram = getKey('DEEPGRAM_API_KEY')
  const elevenlabs = getKey('ELEVENLABS_API_KEY')
  // At minimum need Azure OpenAI + at least one TTS provider
  return !!(azureEndpoint && azureKey && (deepgram || elevenlabs))
}
