# !You - AI Phone Assistant

An AI-powered phone assistant that answers calls in your voice using Twilio, AssemblyAI, OpenAI/Gemini, and Fish Audio.

## Features

- Clean, minimal dashboard with mode toggles and call logs
- Multiple operating modes: Normal, Meeting, Vacation, and Off
- Real-time call handling via Twilio webhooks
- Speech-to-text transcription with AssemblyAI
- AI-powered call analysis and response generation
- Text-to-speech in your cloned voice using Fish Audio
- Google Calendar integration for scheduling

## Tech Stack

**Framework & Hosting**
- Next.js 14 (App Router, TypeScript)
- Deployed on Vercel
- TailwindCSS for styling

**Telephony**
- Twilio Programmable Voice

**AI Services**
- AssemblyAI for speech-to-text
- OpenAI or Gemini for LLM reasoning
- Fish Audio for voice cloning and TTS

**Integrations**
- Google Calendar API
- In-memory state management (upgradeable to database)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `env.example` to `.env.local` and fill in your API keys

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Deploy to Vercel and configure Twilio webhook to point to:
   ```
   https://your-vercel-domain.vercel.app/api/twilio/voice
   ```

## Environment Variables

See `.env.example` for required environment variables.

## Project Structure

```
!You/
  app/
    api/
      state/route.ts       # Dashboard state management
      twilio/voice/route.ts # Twilio webhook handler
      calls/route.ts       # Call logs API
    layout.tsx
    page.tsx              # Main dashboard UI
    globals.css
  lib/
    state.ts              # State management
    ai.ts                 # AI service integrations
    twilio.ts             # Twilio utilities
  .env.local              # Environment variables (not committed)
  .env.example            # Example environment variables
```

## Usage

1. Set your preferred mode from the dashboard
2. Optionally add a custom message for the AI to include
3. The assistant will handle incoming calls based on your selected mode
4. View call logs and actions in the dashboard

## Development Notes

- The current implementation uses Twilio's Record feature for simplicity
- For real-time bidirectional conversation, upgrade to Twilio Media Streams with WebSocket
- AssemblyAI transcription currently uses polling (can be upgraded to streaming)
- Fish Audio integration requires voice cloning setup beforehand

## License

MIT

