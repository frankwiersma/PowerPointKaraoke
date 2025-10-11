# PowerPoint Karaoke AI

An interactive web application that transforms uploaded PDF presentations into AI-powered, narrated performances with personality and humor.

## Features

- **PDF Upload & Viewing**: Upload any PDF presentation and view slides with smooth navigation
- **AI Script Generation**: Google Gemini AI generates witty, charismatic presenter scripts for each slide
- **Text-to-Speech**: Gemini's audio generation brings scripts to life with natural voiceovers
- **Dark Theme UI**: Sleek, modern interface with Tailwind CSS

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **PDF Rendering**: PDF.js (Mozilla)
- **AI**: Google Gemini API (gemini-2.0-flash-exp)
  - Text generation for scripts
  - Audio generation for voiceovers

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API Key**:
   - Copy `.env.example` to `.env`
   - Add your Google Gemini API key:
     ```
     VITE_GEMINI_API_KEY=your_actual_api_key_here
     ```
   - Get your API key from: https://aistudio.google.com/apikey

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## How to Use

1. **Upload a PDF**: Click "Upload PDF" and select a presentation file
2. **Navigate**: Use Previous/Next buttons to browse slides
3. **Generate Script**: Click "✨ Generate Voiceover" to create an AI script for the current slide
4. **Play Audio**: Click "Play" to hear the script read aloud with Gemini's text-to-speech
5. **Control Playback**: Use Pause/Stop buttons to control the voiceover

## Project Structure

```
src/
├── components/
│   ├── AudioControls.tsx      # Play/Pause/Stop controls for voiceover
│   ├── ControlPanel.tsx       # Left panel with all controls
│   ├── FileUpload.tsx         # PDF file upload component
│   ├── Navigation.tsx         # Slide navigation controls
│   ├── ScriptDisplay.tsx      # Script generation & display
│   └── SlideViewer.tsx        # PDF rendering canvas
├── App.tsx                    # Main application component
└── index.css                  # Tailwind CSS imports
```

## API Requirements

- **Google Gemini API**: Requires an API key with access to:
  - Text generation (for scripts)
  - Audio generation (for voiceovers)
  - Model: `gemini-2.0-flash-exp`

## License

MIT
