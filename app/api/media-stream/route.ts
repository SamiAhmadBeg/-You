import { type NextRequest } from "next/server"
import { WebSocketServer, WebSocket } from "ws"
import { createServer } from "http"
import { createSession, getSession, endSession, updateSession } from "@/lib/call-session"
import { createAssemblyAIStream } from "@/lib/assemblyai-stream"
import { twilioToAssemblyAI, audioToTwilio } from "@/lib/audio-converter"
import { processUtterance, generateCallSummary } from "@/lib/conversation"
import { synthesizeSpeech } from "@/lib/fish-audio"
import { addCallLog } from "@/lib/state"

export const runtime = "nodejs"

// Create WebSocket server (this runs once when the route is loaded)
const wss = new WebSocketServer({ noServer: true })

/**
 * Handle WebSocket upgrade for Twilio Media Streams
 */
export async function GET(req: NextRequest) {
  const { socket, response } = await upgradeWebSocket(req)
  return response
}

/**
 * Upgrade HTTP connection to WebSocket
 */
async function upgradeWebSocket(req: NextRequest) {
  return new Promise<{ socket: WebSocket; response: Response }>((resolve) => {
    // Extract the underlying Node.js request and socket
    const server = createServer()

    wss.handleUpgrade(req as any, (req as any).socket, Buffer.alloc(0), (ws: WebSocket) => {
      console.log("🔌 WebSocket connection established")

      // Handle the WebSocket connection
      handleWebSocketConnection(ws)

      resolve({
        socket: ws,
        response: new Response(null, {
          status: 101,
          statusText: "Switching Protocols",
        }),
      })
    })
  })
}

/**
 * Handle individual WebSocket connection from Twilio
 */
function handleWebSocketConnection(ws: WebSocket) {
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
async function handleStart(ws: WebSocket, msg: any) {
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
        // Partial transcripts - log but don't process
        return
      }

      // Final transcript - process with LLM
      console.log(`📝 Final transcript from caller: "${transcript}"`)

      try {
        // Generate AI response
        const aiResponse = await processUtterance(callSid, transcript)

        if (!aiResponse) {
          return // Skip if already processing
        }

        console.log(`🤖 AI response: "${aiResponse}"`)

        // Convert AI response to speech using Fish Audio
        const audioBuffer = await synthesizeSpeech(aiResponse)

        // Convert to Twilio format (mulaw, 8kHz, base64)
        const twilioAudio = audioToTwilio(audioBuffer, 8000)

        // Send audio back to caller via WebSocket
        sendAudioToTwilio(ws, streamSid, twilioAudio)
      } catch (error) {
        console.error("Error processing transcript:", error)

        // Send error message to caller
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

  // Connect to AssemblyAI
  await assemblyAIStream.connect()

  // Store in session
  updateSession(callSid, { assemblyAIStream })

  // Send a greeting to the caller
  try {
    const greeting = "Hi, this is your AI assistant. How can I help you today?"
    const greetingAudio = await synthesizeSpeech(greeting)
    const twilioAudio = audioToTwilio(greetingAudio, 8000)
    sendAudioToTwilio(ws, streamSid, twilioAudio)

    // Add greeting to conversation history
    const { addMessage } = await import("@/lib/call-session")
    addMessage(callSid, "assistant", greeting)
  } catch (error) {
    console.error("Error sending greeting:", error)
  }
}

/**
 * Handle 'media' event from Twilio (incoming audio)
 */
async function handleMedia(callId: string, msg: any) {
  const session = getSession(callId)
  if (!session || !session.assemblyAIStream) {
    return
  }

  try {
    // Get audio payload from Twilio (base64-encoded mulaw)
    const audioPayload = msg.media.payload

    // Convert Twilio audio to AssemblyAI format (PCM 16-bit, 16kHz)
    const pcmAudio = twilioToAssemblyAI(audioPayload)

    // Send to AssemblyAI for transcription
    session.assemblyAIStream.sendAudio(pcmAudio)
  } catch (error) {
    console.error("Error processing media:", error)
  }
}

/**
 * Handle 'stop' event from Twilio (end of call)
 */
async function handleStop(callId: string) {
  console.log(`📴 Call ended: ${callId}`)

  try {
    // Generate call summary
    const summary = await generateCallSummary(callId)

    const session = getSession(callId)
    if (session) {
      // Add to call log
      addCallLog({
        id: callId,
        from: session.callerPhone,
        time: session.startTime.toISOString(),
        modeAtTime: "normal", // TODO: Get actual mode at call time
        summary,
        action: "completed",
      })
    }

    // End session
    await endSession(callId)
  } catch (error) {
    console.error("Error handling call stop:", error)
  }
}

/**
 * Send audio to Twilio via WebSocket
 */
function sendAudioToTwilio(ws: WebSocket, streamSid: string, base64Audio: string) {
  // Split audio into chunks (Twilio recommends ~20ms chunks = ~320 bytes for mulaw @ 8kHz)
  const chunkSize = 320
  const audioBuffer = Buffer.from(base64Audio, "base64")

  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    const chunk = audioBuffer.slice(i, i + chunkSize)
    const base64Chunk = chunk.toString("base64")

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

