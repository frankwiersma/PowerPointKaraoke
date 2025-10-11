# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # TypeScript compilation + production build
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
```

## Architecture Overview

### Core Data Flow

This application implements an intelligent **prefetching pipeline** for seamless slide-to-slide transitions:

1. **Current Slide**: Content extraction → Script generation → Audio generation → Playback
2. **Background (while presenting)**: Next slide content → Next slide script → Next slide audio (all cached)
3. **Navigate to next slide**: Everything loads instantly from cache

### State Management Pattern

The app uses a **distributed caching system** across three layers managed in `App.tsx`:

```typescript
contentCache: Record<number, string>  // Page number → Extracted markdown content
scriptCache: Record<number, string>   // Page number → Generated presenter script
audioCache: Record<number, string>    // Page number → Audio blob URL
```

These caches are passed down through `ControlPanel` → `ScriptDisplay` and `AudioControls` to enable prefetching.

### Component Responsibilities

**App.tsx**
- Owns all cache state (content, script, audio)
- Manages `currentPage`, `autoGenerateTrigger`, `stopAudioTrigger`
- Handles page transitions with proper cleanup (stops audio, saves history)

**ScriptDisplay.tsx**
- **Content Extraction**: Uses `extractContentForPage(pageNumber)` helper that:
  - Renders PDF page to canvas (2x resolution)
  - Converts to base64 PNG
  - Sends to Azure OpenAI GPT-4o Vision API
  - Returns markdown with ALL text (including text in images/charts/diagrams)
- **Script Generation**: Azure OpenAI GPT-4o with context awareness:
  - Maintains `scriptHistory` for narrative continuity
  - Uses `presentationContext` established on first slide
  - Avoids repetitive transitions ("okay folks", "this leads us to")
- **Prefetching Logic**: After current slide script completes, automatically:
  1. Extracts next slide content (if not cached)
  2. Generates next slide script (if not cached)
  3. Generates next slide audio (if not cached)

**AudioControls.tsx**
- **Race Condition Protection**:
  - Uses `AbortController` to cancel in-flight audio requests
  - Tracks `currentPageRef` to detect page changes during async operations
  - Multiple validation points: before generation, after response, before playback
  - Gracefully aborts without showing errors when navigating away
- **Auto-play Integration**: Responds to `autoPlayTrigger` changes
- **Cleanup**: Stops audio and aborts requests when `currentPage` or `script` changes

### API Integration Architecture

**Azure OpenAI GPT-4o** (primary):
- Content extraction via Vision API (accepts base64 images)
- Script generation via Chat Completions API
- Endpoint pattern: `{endpoint}openai/deployments/{model}/chat/completions?api-version={version}`

**Deepgram TTS**:
- Audio generation via REST API
- Model: `aura-2-hermes-en`
- Returns audio blob that's converted to object URL for playback

**Gemini** (available but not currently used):
- Originally used, kept in codebase as fallback option
- Model: `gemini-2.5-flash`

### Critical Implementation Details

**Tailwind CSS v4**:
- Uses new `@import "tailwindcss"` syntax (NOT `@tailwind` directives)
- Requires `@tailwindcss/postcss` plugin in `postcss.config.js`

**PDF.js Worker**:
- Worker file must be copied to public directory via `vite-plugin-static-copy`
- Set worker path: `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`

**Fullscreen Layout**:
- Uses `position: fixed` on `#root` with `!important` margin/padding resets
- Control panel uses inline `style={{ padding: '1rem' }}` to override global resets

**Auto-generation Trigger Flow**:
1. Upload PDF or click Next → `autoGenerateTrigger` increments
2. ScriptDisplay watches `slideText` changes (not trigger directly)
3. When `slideText` updates AND `!isExtracting` AND `autoGenerateTrigger > 0` → generate script
4. When script completes → `setAutoPlayTrigger(prev => prev + 1)`
5. AudioControls watches `autoPlayTrigger` → generates and plays audio

## Environment Variables

Required in `.env`:
```
VITE_OPENAI_ENDPOINT=https://[your-instance].openai.azure.com/
VITE_OPENAI_KEY=your_azure_openai_key
VITE_OPENAI_MODEL=gpt-4o
VITE_API_VERSION=2025-01-01-preview
VITE_DEEPGRAM_API_KEY=your_deepgram_key
VITE_GEMINI_API_KEY=your_gemini_key  # Optional fallback
```

## Key Patterns to Follow

**When adding new prefetching**:
- Check cache first before generating
- Store page number at start of async operation
- Validate page hasn't changed before updating state
- Use console.log for prefetch confirmation

**When modifying navigation**:
- Always increment `stopAudioTrigger` to stop current audio
- Save current script to `scriptHistory` before changing pages
- Clear `generatedScript` for new page
- Increment `autoGenerateTrigger` to start new slide pipeline

**When working with async operations**:
- Use `AbortController` for cancellable requests
- Use refs to track mutable values (like `currentPageRef`)
- Check if operation is still relevant before updating state
- Handle abort errors gracefully without user alerts

**Script generation prompt engineering**:
- Emphasize NO stage directions, NO parenthetical actions
- Prohibit repetitive openings and explicit transitions
- Focus on natural flow through tone and content
- Provide context from previous slides (last 3) for continuity
