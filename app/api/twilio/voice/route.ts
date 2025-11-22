import { type NextRequest, NextResponse } from "next/server"
import { getState, addCallLog } from "@/lib/state"
import { transcribeAudioAssemblyAI, decideReplyAndAction } from "@/lib/ai"

export const runtime = "nodejs" // Twilio expects node/serverful behaviour

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callStatus = formData.get("CallStatus")
  const from = (formData.get("From") as string) ?? "Unknown"

  const { assistantEnabled, mode, customMessage } = getState()

  // 1) If assistant is off, reject/busy
  if (!assistantEnabled || mode === "off") {
    const twiml = `
      <Response>
        <Reject reason="busy" />
      </Response>
    `
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  // 2) If this is the initial webhook (no RecordingUrl yet): ask Twilio to record message
  const recordingUrl = formData.get("RecordingUrl") as string | null

  if (!recordingUrl) {
    const twiml = `
      <Response>
        <Say voice="alice">Hi, this is your assistant. Please say your message after the tone.</Say>
        <Record maxLength="30" action="/api/twilio/voice" playBeep="true" />
        <Say voice="alice">No message recorded, goodbye.</Say>
        <Hangup/>
      </Response>
    `
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  // 3) If we have a RecordingUrl, process it with AssemblyAI and respond
  const transcript = await transcribeAudioAssemblyAI(recordingUrl)
  const decision = await decideReplyAndAction({
    transcript,
    mode,
    customMessage,
  })

  // Log the call
  addCallLog({
    id: crypto.randomUUID(),
    from,
    time: new Date().toISOString(),
    modeAtTime: mode,
    summary: transcript.slice(0, 200),
    action: decision.action,
  })

  // Note: For full effect, you would:
  // - Generate TTS via Fish
  // - <Play> the resulting URL
  // For now, we'll just <Say> the reply.
  const twiml = `
    <Response>
      <Say voice="alice">${decision.reply}</Say>
      <Hangup/>
    </Response>
  `

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}
