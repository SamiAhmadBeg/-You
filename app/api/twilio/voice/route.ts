import { type NextRequest, NextResponse } from "next/server"
import { getState } from "@/lib/state"
import { synthesizeSpeech } from "@/lib/fish-audio"
import { generateDynamicGreeting } from "@/lib/conversation"
import { createSession } from "@/lib/call-session"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = (formData.get("From") as string) ?? "Unknown"
  const callSid = (formData.get("CallSid") as string) ?? "unknown"

  const { assistantEnabled, mode } = getState()

  console.log(`📞 Incoming call from ${from}, mode: ${mode}, enabled: ${assistantEnabled}`)

  // If assistant is off, reject/busy
  if (!assistantEnabled || mode === "off") {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Reject reason="busy" />
      </Response>
    `
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  // Create session for this call
  createSession(callSid, from)

  // Generate greeting using Fish Audio
  const greeting = await generateDynamicGreeting(callSid, from)
  const audioResult = await synthesizeSpeech(greeting)

  // Store audio and get URL
  const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
  const audioId = storeAudio(audioResult.pcmData)

  const host = req.headers.get("host") || "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const baseUrl = `${protocol}://${host}`
  const audioUrl = `${baseUrl}/api/tts-audio/${audioId}`

  console.log(`🎵 Greeting audio URL: ${audioUrl}`)

  // Generate a Fish Audio response for the timeout fallback
  const timeoutAudio = await synthesizeSpeech("Hey, you still there? Give me a call back if you need me!")
  const timeoutAudioId = storeAudio(timeoutAudio.pcmData)
  const timeoutUrl = `${baseUrl}/api/tts-audio/${timeoutAudioId}`

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather input="speech" action="${baseUrl}/api/twilio/gather" speechTimeout="auto" language="en-US">
        <Play>${audioUrl}</Play>
      </Gather>
      <Play>${timeoutUrl}</Play>
      <Hangup />
    </Response>
  `

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}

