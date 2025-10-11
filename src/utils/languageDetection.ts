// Language detection utility
// Analyzes multiple script samples to determine the predominant language

export type PresentationLanguage = 'dutch' | 'english'

const dutchWords = [
  'de', 'het', 'een', 'van', 'in', 'op', 'voor', 'met', 'aan', 'dat', 'dit',
  'zijn', 'worden', 'hebben', 'kunnen', 'moeten', 'willen', 'gaan', 'maken',
  'deze', 'zoals', 'maar', 'ook', 'niet', 'naar', 'door', 'over', 'om',
  'bij', 'uit', 'meer', 'andere', 'alle', 'veel', 'nog', 'wel',
  'bijvoorbeeld', 'namelijk', 'waarom', 'hoe', 'wanneer', 'waar', 'wie',
  'wordt', 'werd', 'waren', 'was', 'bent', 'had', 'hadden'
]

/**
 * Detect if a single text is Dutch
 */
export function isDutchText(text: string): boolean {
  const lowerText = text.toLowerCase()
  const words = lowerText.split(/\s+/)
  const dutchWordCount = words.filter(word =>
    dutchWords.includes(word.replace(/[.,!?;:]$/, ''))
  ).length
  const threshold = words.length * 0.2
  return dutchWordCount >= threshold && dutchWordCount >= 3
}

/**
 * Analyze multiple script samples and determine the predominant language
 * Returns the language with the most confidence across all samples
 *
 * @param scripts - Array of script texts to analyze
 * @returns 'dutch' or 'english'
 */
export function detectPresentationLanguage(scripts: string[]): PresentationLanguage {
  if (scripts.length === 0) {
    console.warn('[LanguageDetection] No scripts provided, defaulting to Dutch')
    return 'dutch'
  }

  let dutchCount = 0
  let englishCount = 0

  // Analyze each script
  scripts.forEach((script, index) => {
    if (!script || !script.trim()) {
      console.warn(`[LanguageDetection] Slide ${index + 1}: Empty script, skipping`)
      return
    }

    const isDutch = isDutchText(script)
    if (isDutch) {
      dutchCount++
      console.log(`[LanguageDetection] Slide ${index + 1}: Detected Dutch`)
    } else {
      englishCount++
      console.log(`[LanguageDetection] Slide ${index + 1}: Detected English`)
    }
  })

  // Determine predominant language
  const language: PresentationLanguage = dutchCount > englishCount ? 'dutch' : 'english'

  console.log(`[LanguageDetection] Analysis complete:`)
  console.log(`[LanguageDetection] - Dutch slides: ${dutchCount}`)
  console.log(`[LanguageDetection] - English slides: ${englishCount}`)
  console.log(`[LanguageDetection] - Determined language: ${language.toUpperCase()}`)

  return language
}

/**
 * Get the recommended number of slides to analyze for language detection
 * Returns min(totalSlides, 3) to analyze 1-3 slides
 */
export function getSlidesToAnalyze(totalSlides: number): number {
  return Math.min(totalSlides, 3)
}
