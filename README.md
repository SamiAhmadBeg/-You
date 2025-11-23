<div align="center">

# !YOU

### *Not you picking up, so YOU don't miss what matters!*

[![Live Demo](https://img.shields.io/badge/Live_Demo-Railway-9b59b6?style=for-the-badge)](https://you-production-6246.up.railway.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

---

**An AI-powered voice assistant that automatically answers phone calls, conducts natural conversations, and stores transcripts in real-time.**

[**Try it now**](#-quick-start) • [Features](#-features) • [Architecture](#-architecture) • [Setup](#-installation)

</div>

---

## Quick Start

### Try the Live Demo

1. **Call the AI**: `866-825-4384`
2. **Dashboard**: [https://you-production-6246.up.railway.app/](https://you-production-6246.up.railway.app/)

Experience real-time AI conversations powered by cutting-edge speech and language models.

---

## Features

<table>
<tr>
<td width="50%">

### **Intelligent Conversations**
- Real-time speech recognition with **AssemblyAI**
- Natural language processing via **OpenAI GPT-4o-mini**
- Context-aware responses

</td>
<td width="50%">

### **Neural Voice Synthesis**
- High-fidelity TTS with **Fish Audio**
- OpenAI TTS fallback
- Custom voice cloning support

</td>
</tr>
<tr>
<td>

### **Call Management**
- Live call monitoring dashboard
- Complete conversation transcripts
- AI-generated call summaries

</td>
<td>

### **Real-Time Streaming**
- WebSocket-based audio streaming
- Low-latency voice processing
- Seamless Twilio integration

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────┐
│ Incoming    │
│ Phone Call  │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│                    Twilio Gateway                       │
│            (Media Stream via WebSocket)                 │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ↓
         ┌─────────────────────────────────┐
         │   Node.js + Next.js Server      │
         │  (WebSocket Handler & API)      │
         └────────────┬────────────────────┘
                      │
         ┌────────────┼────────────┐
         ↓            ↓            ↓
    ┌────────┐  ┌─────────┐  ┌──────────┐
    │Assembly│  │ OpenAI  │  │   Fish   │
    │   AI   │  │ GPT-4o  │  │  Audio   │
    │  (STT) │  │  (LLM)  │  │  (TTS)   │
    └────┬───┘  └────┬────┘  └────┬─────┘
         │           │            │
         └───────────┼────────────┘
                     │
                     ↓
         ┌───────────────────────┐
         │   Audio Processing    │
         │ PCM/mulaw Conversion  │
         │   Sample Rate Adjust  │
         └───────────┬───────────┘
                     │
                     ↓
              Back to Caller
```

### Audio Pipeline

```
       Twilio (mulaw 8kHz) → PCM 16kHz → AssemblyAI (STT)
                             ↓
                        Transcript
                             ↓
                        OpenAI LLM
                             ↓
                        AI Response
                             ↓
Fish Audio/OpenAI TTS → PCM 24kHz → Downsample 8kHz → mulaw → Twilio
```

---

## Installation

### Prerequisites

- **Node.js** 22+ ([Download](https://nodejs.org/))
- **npm** 10+ (comes with Node.js)
- **API Keys**:
  - [OpenAI](https://platform.openai.com/api-keys)
  - [AssemblyAI](https://www.assemblyai.com/app)
  - [Fish Audio](https://fish.audio/)
  - [Twilio](https://console.twilio.com/)

### Local Development

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd -You

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp env.example .env.local
# Edit .env.local with your API keys

# 4. Start the development server
npm run dev
```

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# OpenAI API Key (for LLM responses and TTS fallback)
OPENAI_API_KEY=sk-your-openai-api-key

# Fish Audio API Key (for neural TTS)
FISH_API_KEY=your-fish-audio-api-key

# Fish Audio Voice ID (optional, for voice cloning)
FISH_VOICE_ID=your-fish-voice-id

# Twilio Credentials (for phone call integration)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Gemini API Key (optional, for alternative LLM)
GEMINI_API_KEY=your-gemini-api-key

# Railway Public Domain (optional, auto-set on Railway)
RAILWAY_PUBLIC_DOMAIN=your-app.up.railway.app
```

### Deployment on Railway

1. **Connect Repository**
   ```bash
   # Push your code to GitHub
   git push origin main
   ```

2. **Deploy to Railway**
   - Visit [Railway.app](https://railway.app/)
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Add environment variables from `env.example`

3. **Configure Twilio Webhook**
   - Copy your Railway URL: `https://your-app.up.railway.app`
   - In [Twilio Console](https://console.twilio.com/), set webhook:
     - URL: `https://your-app.up.railway.app/api/twilio/voice`
     - Method: `POST`

---

## Tech Stack

<table>
<tr>
<td align="center"><b>Frontend</b></td>
<td align="center"><b>Backend</b></td>
<td align="center"><b>AI/ML</b></td>
<td align="center"><b>Infrastructure</b></td>
</tr>
<tr>
<td>
• Next.js 16<br/>
• React 19<br/>
• TailwindCSS<br/>
• Radix UI<br/>
• TypeScript
</td>
<td>
• Node.js 22<br/>
• Express<br/>
• WebSocket (ws)<br/>
• Twilio SDK<br/>
• FFmpeg
</td>
<td>
• OpenAI GPT-4o-mini<br/>
• AssemblyAI Universal-2<br/>
• Fish Audio TTS<br/>
• Custom Audio Pipeline
</td>
<td>
• Railway<br/>
• Twilio Voice<br/>
• Real-time Streaming<br/>
• WebSocket
</td>
</tr>
</table>

---

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/twilio/voice` | POST | Twilio webhook for incoming calls |
| `/api/media-stream` | WebSocket | Real-time audio streaming |
| `/api/calls` | GET | Retrieve call history |
| `/api/tts` | POST | Text-to-speech synthesis |
| `/api/test-assemblyai` | GET | Test AssemblyAI connection |
| `/api/test-openai` | GET | Test OpenAI connection |
| `/api/test-fish` | GET | Test Fish Audio connection |

---

## Testing

### Test Individual Services

Visit these pages in your browser:

- **API Status**: `/test-api` - Verify all API keys and connectivity
- **TTS Demo**: `/test-tts` - Test text-to-speech synthesis
- **Dashboard**: `/` - Monitor calls and view transcripts

### Test Phone Call

1. Call your Twilio number: `866-825-4384`
2. Have a conversation with the AI
3. View the transcript in the dashboard

---

## Troubleshooting

<details>
<summary><b>Audio is garbled or noisy</b></summary>

- Ensure TTS returns PCM format (not MP3)
- Verify sample rate conversions: 24kHz → 8kHz
- Check `audioToTwilio()` receives correct sample rate parameter

</details>

<details>
<summary><b>AssemblyAI connection fails</b></summary>

- Verify API key is valid and has credits
- Check API key has real-time streaming permissions
- Ensure using Universal-2 model (default in SDK v4+)

</details>

<details>
<summary><b>Twilio webhook not responding</b></summary>

- Verify webhook URL is publicly accessible (use ngrok for local dev)
- Check TwiML returns `<Stream>` tag correctly
- Ensure WebSocket endpoint `/api/media-stream` is running

</details>

<details>
<summary><b>"Not authorized" error</b></summary>

- Double-check all API keys in `.env.local`
- Ensure no spaces around `=` in environment variables
- Restart the dev server after changing `.env.local`

</details>

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

**Special thanks to [Fish Audio](https://fish.audio/) for sponsoring this MadHacks project!**

<div align="center">
       
---

Made with ❤️ for **MadHacks 2025**

</div>
