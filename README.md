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

3. Copy `env.example` to `.env.local` and fill in your API keys (Twilio credentials required)

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

6. **For local testing with Twilio:**
   - Install ngrok: `brew install ngrok` (Mac) or download from ngrok.com
   - Run ngrok: `ngrok http 3000`
   - Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
   - In Twilio Console, configure your phone number's voice webhook to:
     ```
     https://abc123.ngrok.io/api/twilio/voice
     ```
     Method: **HTTP POST**

7. **For production:**
   - Deploy to Vercel
   - Configure Twilio webhook to:
     ```
     https://your-vercel-domain.vercel.app/api/twilio/voice
     ```
     Method: **HTTP POST**

## Environment Variables

See `env.example` for all available environment variables.

**Required for basic functionality:**
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token

**Optional (for future features):**
- AI Services (OpenAI or Gemini)
- AssemblyAI for transcription
- Fish Audio for voice cloning
- Google Calendar integration

## Twilio Setup Guide

1. **Create a Twilio account** at [twilio.com](https://www.twilio.com/try-twilio)

2. **Get a phone number:**
   - Go to Phone Numbers → Manage → Buy a number
   - Choose a number with Voice capabilities

3. **Find your credentials:**
   - Go to Console Dashboard
   - Copy your Account SID and Auth Token
   - Add them to `.env.local`

4. **Configure the webhook:**
   - Go to Phone Numbers → Manage → Active Numbers
   - Click on your phone number
   - Under "Voice Configuration" → "A CALL COMES IN":
     - Set webhook URL to your ngrok or Vercel URL + `/api/twilio/voice`
     - Method: HTTP POST
     - Save

5. **Test it:**
   - Call your Twilio number
   - The call should be logged in your dashboard
   - You'll hear the greeting based on your current mode

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

<<<<<<< HEAD
1. Set your preferred mode from the dashboard
2. Optionally add a custom message for the AI to include
3. The assistant will handle incoming calls based on your selected mode
4. View call logs and actions in the dashboard
=======
1. Set your preferred mode from the dashboard:
   - **Normal**: Answers with default greeting
   - **Meeting**: Tells callers you're in a meeting
   - **Vacation**: Tells callers you're on vacation
   - **Off**: Rejects calls (busy signal)

2. Optionally add a custom message to override the default greeting

3. The assistant will handle incoming calls based on your selected mode

4. View call logs in real-time on the dashboard

## Current Functionality

✅ **Working Now:**
- Twilio phone number integration
- Call pickup and greeting based on mode
- Custom message support
- Real-time call logging in dashboard
- Mode-based call handling (normal/meeting/vacation/off)

🚧 **Coming Soon:**
- Voice recording and transcription (AssemblyAI)
- AI-powered responses (OpenAI/Gemini)
- Voice cloning (Fish Audio)
- Calendar integration
>>>>>>> 09af2384acb9376de945565d5f3e4266f8435ec1

## Development Notes

- The current implementation uses Twilio's Record feature for simplicity
- For real-time bidirectional conversation, upgrade to Twilio Media Streams with WebSocket
- AssemblyAI transcription currently uses polling (can be upgraded to streaming)
- Fish Audio integration requires voice cloning setup beforehand

## License

MIT

