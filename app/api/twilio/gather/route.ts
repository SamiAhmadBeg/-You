import { type NextRequest, NextResponse } from "next/server"
import { synthesizeSpeech } from "@/lib/fish-audio"
import { processUtterance } from "@/lib/conversation"
import { createSession, addMessage } from "@/lib/call-session"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = (formData.get("From") as string) ?? "Unknown"
  const speechResult = (formData.get("SpeechResult") as string) ?? ""
  const callSid = (formData.get("CallSid") as string) ?? "unknown"

  console.log(`🎤 Speech from ${from}: "${speechResult}"`)

  // Create or get session
  let session = require("@/lib/call-session").getSession(callSid)
  if (!session) {
    session = createSession(callSid, from)
  }

  // Add caller's message
  addMessage(callSid, "caller", speechResult)

  // Generate AI response using OpenAI
  const aiResponse = await processUtterance(callSid, speechResult)

  if (!aiResponse) {
    // Error occurred
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Matthew-Neural">Sorry, I'm having trouble right now. Please try again later.</Say>
        <Hangup />
      </Response>
    `
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  console.log(`🤖 AI Response: "${aiResponse}"`)

  // Generate high-quality Fish Audio MP3
  const audioResult = await synthesizeSpeech(aiResponse)
  
  // Store audio and get URL
  const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
  const audioId = storeAudio(audioResult.pcmData)
  
  const host = req.headers.get("host") || "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const audioUrl = `${protocol}://${host}/api/tts-audio/${audioId}`

  // Continue conversation with <Gather>
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather input="speech" action="${protocol}://${host}/api/twilio/gather" speechTimeout="auto" language="en-US">
        <Play>${audioUrl}</Play>
      </Gather>
      <Say voice="Polly.Matthew-Neural">Thanks for calling! Talk soon.</Say>
      <Hangup />
    </Response>
  `

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}

