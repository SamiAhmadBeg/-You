import type { WebSocket } from "ws"
import { createSession, getSession, endSession, updateSession, addMessage } from "./call-session"
import { createAssemblyAIStream } from "./assemblyai-stream"
import { twilioToAssemblyAI, audioToTwilio } from "./audio-converter"
import { processUtterance, generateCallSummary } from "./conversation"
import { synthesizeSpeech } from "./fish-audio"
import { addCallLog } from "./state"

/**
 * Handle Twilio WebSocket connection
 */
export function handleTwilioWebSocket(ws: WebSocket, request: any): void {
  let callId: string | null = null
  let streamSid: string | null = null

  ws.on("message", async (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString())

      switch (msg.event) {
        case "start":
          await handleStart(ws, msg)
          callId = msg.start.callSid
          streamSid = msg.start.streamSid
          break

        case "media":
          if (callId) {
            await handleMedia(callId, msg)
          }
          break

        case "stop":
          if (callId) {
            await handleStop(callId)
          }
          break

        default:
          console.log("Unknown Twilio event:", msg.event)
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error)
    }
  })

  ws.on("close", async () => {
    console.log("🔌 WebSocket connection closed")
    if (callId) {
      await endSession(callId)
    }
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
  })
}

/**
 * Handle 'start' event from Twilio (beginning of call)
 */
async function handleStart(ws: WebSocket, msg: any): Promise<void> {
  const callSid = msg.start.callSid
  const from = msg.start.customParameters?.From || "Unknown"
  const streamSid = msg.start.streamSid

  console.log(`📞 Call started: ${callSid} from ${from}`)

  // Create call session
  const session = createSession(callSid, from)
  session.twilioWebSocket = ws
  session.streamSid = streamSid

  // Create AssemblyAI streaming client
  const assemblyAIStream = createAssemblyAIStream({
    onTranscript: async (transcript: string, isFinal: boolean) => {
      if (!isFinal) {
        return
      }

      console.log(`📝 Final transcript from caller: "${transcript}"`)

      try {
        const aiResponse = await processUtterance(callSid, transcript)

        if (!aiResponse) {
          return
        }

        console.log(`🤖 AI response: "${aiResponse}"`)

        // Generate MP3 audio (higher quality than streaming PCM)
        const audioResult = await synthesizeSpeech(aiResponse)
        console.log(`🎵 Audio: ${audioResult.sampleRate}Hz, ${audioResult.pcmData.length} bytes`)

        // Store MP3 and get URL
        const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
        const audioId = storeAudio(audioResult.pcmData)
        const audioUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || "you-production-6246.up.railway.app"}/api/tts-audio/${audioId}`

        // Send <Play> command to Twilio for HD audio playback
        ws.send(
          JSON.stringify({
            event: "clear",
            streamSid,
          })
        )

        ws.send(
          JSON.stringify({
            event: "mark",
            streamSid,
            mark: {
              name: `play-${audioId}`,
            },
          })
        )

        // Twilio will fetch and play the MP3 at higher quality
        console.log(`🔊 Playing audio from: ${audioUrl}`)
        
        // Note: We can't use <Play> from WebSocket directly
        // Need to use Media Streams 'media' event with better encoding
        const twilioAudio = audioToTwilio(audioResult.pcmData, audioResult.sampleRate)
        sendAudioToTwilio(ws, streamSid, twilioAudio)
      } catch (error) {
        console.error("Error processing transcript:", error)

        try {
          const fallbackAudioResult = await synthesizeSpeech(
            "I'm sorry, I'm having technical difficulties. Please try again later."
          )
          const twilioAudio = audioToTwilio(fallbackAudioResult.pcmData, fallbackAudioResult.sampleRate)
          sendAudioToTwilio(ws, streamSid, twilioAudio)
        } catch (e) {
          console.error("Failed to send fallback message:", e)
        }
      }
    },
    onError: (error) => {
      console.error("AssemblyAI error:", error)
    },
    onOpen: (sessionId) => {
      console.log(`✅ AssemblyAI connected: ${sessionId}`)
    },
    onClose: () => {
      console.log("AssemblyAI connection closed")
    },
  })

  await assemblyAIStream.connect()
  updateSession(callSid, { assemblyAIStream })

  try {
    // Generate dynamic greeting using AI
    const greeting = await generateDynamicGreeting(callSid, from)
    console.log(`👋 Greeting: "${greeting}"`)
    
    const audioResult = await synthesizeSpeech(greeting)
    const twilioAudio = audioToTwilio(audioResult.pcmData, audioResult.sampleRate)
    sendAudioToTwilio(ws, streamSid, twilioAudio)

    addMessage(callSid, "assistant", greeting)
  } catch (error) {
    console.error("Error sending greeting:", error)
  }
}

/**
 * Generate a dynamic greeting using AI
 */
async function generateDynamicGreeting(callSid: string, from: string): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    return "Hey! Sami here. What's up?"
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Sami answering your phone. Generate a natural, casual greeting for an incoming call. Keep it SHORT (5-8 words max). Sound like a real person picking up their phone.

Examples:
- "Hey! Sami here. What's up?"
- "Yo, this is Sami!"
- "Hey, what's going on?"
- "Sami speaking!"
- "Yo! What's up?"

Be natural and casual. No formal language.`
          },
          {
            role: "user",
            content: "Generate a greeting"
          }
        ],
        temperature: 0.9,
        max_tokens: 20,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const greeting = data.choices?.[0]?.message?.content?.trim()

    return greeting || "Hey! Sami here. What's up?"
  } catch (error) {
    console.error("Error generating greeting:", error)
    return "Hey! Sami here. What's up?"
  }
}

/**
 * Handle 'media' event from Twilio (incoming audio)
 */
async function handleMedia(callId: string, msg: any): Promise<void> {
  const session = getSession(callId)
  if (!session || !session.assemblyAIStream) {
    return
  }

  try {
    const audioPayload = msg.media.payload
    const pcmAudio = twilioToAssemblyAI(audioPayload)
    session.assemblyAIStream.sendAudio(pcmAudio)
  } catch (error) {
    console.error("Error processing media:", error)
  }
}

/**
 * Handle 'stop' event from Twilio (end of call)
 */
async function handleStop(callId: string): Promise<void> {
  console.log(`📴 Call ended: ${callId}`)

  try {
    const summary = await generateCallSummary(callId)
    const session = getSession(callId)
    
    if (session) {
      addCallLog({
        id: callId,
        from: session.callerPhone,
        time: session.startTime.toISOString(),
        modeAtTime: "normal",
        summary,
        action: "completed",
      })
    }

    await endSession(callId)
  } catch (error) {
    console.error("Error handling call stop:", error)
  }
}

/**
 * Send audio to Twilio via WebSocket
 */
function sendAudioToTwilio(ws: WebSocket, streamSid: string, base64Audio: string): void {
  const chunkSize = 320
  const audioBuffer = Buffer.from(base64Audio, "base64")

  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    const chunk = audioBuffer.slice(i, i + chunkSize)
    const base64Chunk = chunk.toString('base64')

    ws.send(
      JSON.stringify({
        event: "media",
        streamSid,
        media: {
          payload: base64Chunk,
        },
      })
    )
  }
}

