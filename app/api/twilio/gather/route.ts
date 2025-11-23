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
    // Error occurred - use Fish Audio for error message too
    const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
    const errorAudio = await synthesizeSpeech("Sorry, I'm having trouble right now. Call me back in a bit!")
    const errorAudioId = storeAudio(errorAudio.pcmData)
    
    const host = req.headers.get("host") || "localhost:3000"
    const protocol = host.includes("localhost") ? "http" : "https"
    const errorUrl = `${protocol}://${host}/api/tts-audio/${errorAudioId}`
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>${errorUrl}</Play>
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

  // Generate Fish Audio goodbye message for timeout
  const goodbyeAudio = await synthesizeSpeech("Alright, talk soon! Hit me up if you need anything.")
  const goodbyeAudioId = storeAudio(goodbyeAudio.pcmData)
  const goodbyeUrl = `${protocol}://${host}/api/tts-audio/${goodbyeAudioId}`

  // Continue conversation with <Gather>
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather input="speech" action="${protocol}://${host}/api/twilio/gather" speechTimeout="auto" language="en-US">
        <Play>${audioUrl}</Play>
      </Gather>
      <Play>${goodbyeUrl}</Play>
      <Hangup />
    </Response>
  `

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}

