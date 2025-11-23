import { type NextRequest, NextResponse } from "next/server"
import { getState, addCallLog } from "@/lib/state"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const from = (formData.get("From") as string) ?? "Unknown"
    const callSid = (formData.get("CallSid") as string) ?? crypto.randomUUID()

    const { assistantEnabled, mode, customMessage } = getState()

    console.log(`[Twilio] Call from ${from}, SID: ${callSid}, Mode: ${mode}`)

    // If assistant is off, reject and log
    if (!assistantEnabled || mode === "off") {
      addCallLog({
        id: callSid,
        from,
        time: new Date().toISOString(),
        modeAtTime: mode,
        summary: "Call rejected (assistant off)",
        action: "rejected",
      })

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy" /></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml" } }
      )
    }

    // Build greeting
    let greeting = "Hi, this is your personal assistant."
    if (mode === "meeting") {
      greeting = customMessage || "Hi, I'm currently in a meeting. Please leave a message or try again later."
    } else if (mode === "vacation") {
      greeting = customMessage || "Hi, I'm currently on vacation. Please leave a message and I'll get back to you soon."
    } else if (customMessage) {
      greeting = customMessage
    }

    // Log successful call
    addCallLog({
      id: callSid,
      from,
      time: new Date().toISOString(),
      modeAtTime: mode,
      summary: `Answered in ${mode} mode`,
      action: "answered",
    })

    // Return TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>`

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  } catch (error) {
    console.error("[Twilio] Error:", error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Sorry, an error occurred.</Say><Hangup/></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    )
  }
}
