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

  const { assistantEnabled, mode, customMessage } = getState()

  console.log(`📞 Incoming call from ${from}, mode: ${mode}, enabled: ${assistantEnabled}`)

  const host = req.headers.get("host") || "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const baseUrl = `${protocol}://${host}`

  // If assistant is OFF, reject the call (busy signal)
  if (!assistantEnabled || mode === "off") {
    console.log("❌ Assistant is OFF - rejecting call")
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

  // MEETING MODE - Play message and hang up (no conversation)
  if (mode === "meeting") {
    console.log("📅 MEETING mode - playing message and hanging up")
    
    const meetingMessage = customMessage && customMessage.trim()
      ? customMessage
      : "Yo I'm in a meeting right now, I'll get back to you ASAP"
    
    const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
    const audioResult = await synthesizeSpeech(meetingMessage)
    const audioId = storeAudio(audioResult.pcmData)
    const audioUrl = `${baseUrl}/api/tts-audio/${audioId}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>${audioUrl}</Play>
        <Hangup />
      </Response>
    `
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  // VACATION MODE - Play message, then allow conversation
  if (mode === "vacation") {
    console.log("🏖️ VACATION mode - playing message and listening")
    
    const vacationMessage = customMessage && customMessage.trim()
      ? customMessage
      : "Hey! I'm on vacation right now, just chillin. Do you have something important to tell me?"
    
    const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
    const audioResult = await synthesizeSpeech(vacationMessage)
    const audioId = storeAudio(audioResult.pcmData)
    const audioUrl = `${baseUrl}/api/tts-audio/${audioId}`

    // Generate goodbye message for timeout
    const goodbyeAudio = await synthesizeSpeech("Alright cool, enjoy! Hit me up if you need me.")
    const goodbyeAudioId = storeAudio(goodbyeAudio.pcmData)
    const goodbyeUrl = `${baseUrl}/api/tts-audio/${goodbyeAudioId}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Gather input="speech" action="${baseUrl}/api/twilio/gather" speechTimeout="auto" language="en-US">
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

  // NORMAL MODE - Full conversation
  console.log("💬 NORMAL mode - full conversation")
  
  // Generate greeting using Fish Audio
  const greeting = await generateDynamicGreeting(callSid, from)
  const audioResult = await synthesizeSpeech(greeting)

  // Store audio and get URL
  const { storeAudio } = await import("@/app/api/tts-audio/[audioId]/route")
  const audioId = storeAudio(audioResult.pcmData)
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

