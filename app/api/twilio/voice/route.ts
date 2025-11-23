import { type NextRequest, NextResponse } from "next/server"
import { getState, addCallLog } from "@/lib/state"
import { synthesizeSpeech } from "@/lib/fish-audio"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const from = (formData.get("From") as string) ?? "Unknown"
    const callSid = (formData.get("CallSid") as string) ?? crypto.randomUUID()
    const recordingUrl = formData.get("RecordingUrl") as string | null
    const transcript = formData.get("TranscriptionText") as string | null

    const { assistantEnabled, mode, customMessage } = getState()

    console.log(`📞 Call from ${from}, SID: ${callSid}, Mode: ${mode}`)

    // If assistant is off, reject
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
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject reason="busy" />
</Response>`,
        { status: 200, headers: { "Content-Type": "text/xml" } }
      )
    }

    // If no recording yet, prompt for one
    if (!transcript && !recordingUrl) {
      const greeting = buildGreeting(mode, customMessage)
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
  <Record 
    maxLength="30" 
    transcribe="true"
    transcribeCallback="${req.headers.get("host") || ""}/api/twilio/voice"
    action="/api/twilio/voice" 
    playBeep="true" 
  />
  <Say voice="Polly.Joanna">I didn't catch that. Please try calling again.</Say>
  <Hangup/>
</Response>`

      return new NextResponse(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      })
    }

    // If we have transcript, process and respond
    if (transcript) {
      console.log(`📝 Transcript: "${transcript}"`)

      // Generate AI response using OpenAI
      const aiResponse = await generateAIResponse(transcript, mode, customMessage)
      
      console.log(`🤖 AI Response: "${aiResponse}"`)

      // Log the call
      addCallLog({
        id: callSid,
        from,
        time: new Date().toISOString(),
        modeAtTime: mode,
        summary: `Caller: "${transcript}" | AI: "${aiResponse}"`,
        action: "answered",
      })

      // Return TwiML with AI response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(aiResponse)}</Say>
  <Hangup/>
</Response>`

      return new NextResponse(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      })
    }

    // Default response if something went wrong
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, an error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    )
  }
}

function buildGreeting(mode: string, customMessage?: string): string {
  if (mode === "meeting") {
    return customMessage || "Hi, this is Sami's assistant. He's currently in a meeting. Please leave a message after the beep."
  } else if (mode === "vacation") {
    return customMessage || "Hi, this is Sami's assistant. He's on vacation right now. Please leave a message after the beep."
  } else if (customMessage) {
    return customMessage
  }
  return "Hi, this is Sami's AI assistant. Please leave your message after the beep."
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

async function generateAIResponse(transcript: string, mode: string, customMessage?: string): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY

  if (!OPENAI_API_KEY) {
    return "Thank you for your message. Sami will get back to you soon."
  }

  const systemPrompt = buildSystemPrompt(mode, customMessage)

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const aiReply = data.choices?.[0]?.message?.content?.trim()

    return aiReply || "Thank you for your message. Sami will get back to you soon."
  } catch (error) {
    console.error("OpenAI API error:", error)
    return "Thank you for your message. Sami will get back to you soon."
  }
}

function buildSystemPrompt(mode: string, customMessage?: string): string {
  let prompt = `You are Sami's AI phone assistant. Keep responses SHORT (1-2 sentences max) and natural.

Your role:
- Thank the caller for their message
- Acknowledge what they said
- Let them know Sami will get back to them

Important:
- This is a PHONE CALL - be brief and clear
- Speak naturally, like a helpful assistant
- Don't ask questions (call is ending after your response)`

  switch (mode) {
    case "meeting":
      prompt += `\n\nSami is currently in a meeting. Acknowledge their message and say he'll call back after his meeting.`
      break
    case "vacation":
      prompt += `\n\nSami is on vacation. Acknowledge their message and say he'll get back when he returns.`
      break
    default:
      prompt += `\n\nSami is busy but available. Acknowledge their message and say he'll call back soon.`
  }

  if (customMessage && customMessage.trim()) {
    prompt += `\n\nCustom instruction: ${customMessage}`
  }

  return prompt
}
