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

        const audioBuffer = await synthesizeSpeech(aiResponse)
        const twilioAudio = audioToTwilio(audioBuffer, 8000)

        sendAudioToTwilio(ws, streamSid, twilioAudio)
      } catch (error) {
        console.error("Error processing transcript:", error)

        try {
          const fallbackAudio = await synthesizeSpeech(
            "I'm sorry, I'm having technical difficulties. Please try again later."
          )
          const twilioAudio = audioToTwilio(fallbackAudio, 8000)
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
    const greeting = "Hey! Sami here. What's up?"
    const greetingAudio = await synthesizeSpeech(greeting)
    const twilioAudio = audioToTwilio(greetingAudio, 8000)
    sendAudioToTwilio(ws, streamSid, twilioAudio)

    addMessage(callSid, "assistant", greeting)
  } catch (error) {
    console.error("Error sending greeting:", error)
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

