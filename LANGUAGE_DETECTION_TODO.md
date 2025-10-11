# Language Detection Implementation TODO

## Voltooide Stappen:
✅ Utility functie aangemaakt: `/src/utils/languageDetection.ts`
✅ App.tsx updated met `presentationLanguage` en `languageAnalyzedSlides` state
✅ ControlPanel.tsx updated om language props door te geven
✅ UI toegevoegd voor taal indicator (geen manual selection meer)

## Te Implementeren:

### 1. ScriptDisplay.tsx
- Import `detectPresentationLanguage` en `getSlidesToAnalyze` from utils
- Na genereren van een script: check of taal al bepaald is
- Als `languageAnalyzedSlides < 3`: script toevoegen aan analyse lijst
- Als genoeg scripts (3): `detectPresentationLanguage` aanroepen
- `setPresentationLanguage` met resultaat
- Prefetch audio: gebruik `presentationLanguage` i.p.v. per-script detectie

### 2. AudioControls.tsx  
- Accept `presentationLanguage` prop
- Vervang locale `isDutchText(script)` door `presentationLanguage === 'dutch'`
- Als `presentationLanguage === null`: fallback naar oude detectie (safety)

### 3. ExportVideo.tsx
- Accept `presentationLanguage` en `setPresentationLanguage` props
- Bij start: als `presentationLanguage === null`, analyseer eerste 3 slides
- Gebruik `presentationLanguage` voor ALLE slides consistent
- Log de gedetecteerde taal voor debugging

### 4. ExportVideoSimple.tsx
- Zelfde als ExportVideo.tsx

## Hoe Taaldetectie Werkt:
1. Gebruiker upload PDF
2. Eerste 1-3 slides worden gegenereerd
3. Na elke script generatie: verzamel scripts
4. Zodra 3 scripts (of alle slides als <3): analyseer taal
5. Taal wordt opgeslagen en gebruikt voor ALLE volgende slides
6. Bij export: als taal nog niet bepaald, analyseer eerst

## Test Scenario's:
- [ ] Mix van NL/EN slides → should detect majority language
- [ ] Alle NL slides → should detect Dutch
- [ ] Alle EN slides → should detect English  
- [ ] < 3 slides totaal → should still work
- [ ] Export direct zonder viewer → should analyze first
