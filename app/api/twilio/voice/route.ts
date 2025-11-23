import { type NextRequest, NextResponse } from "next/server"
import { getState } from "@/lib/state"

export const runtime = "nodejs" // Twilio expects node/serverful behaviour

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = (formData.get("From") as string) ?? "Unknown"

  const { assistantEnabled, mode } = getState()

  console.log(`📞 Incoming call from ${from}, mode: ${mode}, enabled: ${assistantEnabled}`)

  // 1) If assistant is off, reject/busy
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

  // 2) Connect to WebSocket for real-time streaming
  // Get the base URL from the request
  const host = req.headers.get("host") || "localhost:3000"
  const protocol = host.includes("localhost") ? "ws" : "wss"
  const wsUrl = `${protocol}://${host}/api/media-stream`

  console.log(`🔌 Connecting call to WebSocket: ${wsUrl}`)

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${wsUrl}">
          <Parameter name="From" value="${from}" />
        </Stream>
      </Connect>
    </Response>
  `

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}
