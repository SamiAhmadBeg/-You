import { type NextRequest, NextResponse } from "next/server"
import { getState } from "@/lib/state"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = (formData.get("From") as string) ?? "Unknown"
  const speechResult = formData.get("SpeechResult") as string | null

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

  // Use <Gather> for HD quality TTS instead of Media Streams
  const host = req.headers.get("host") || "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const baseUrl = `${protocol}://${host}`

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather input="speech" action="${baseUrl}/api/twilio/gather" speechTimeout="auto" language="en-US">
        <Say voice="Polly.Matthew-Neural">Hey! It's Sami. What's up?</Say>
      </Gather>
      <Say>Sorry, I didn't catch that. Please call back.</Say>
    </Response>
  `

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}

