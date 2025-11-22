import type { Mode } from "./state"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const FISH_API_KEY = process.env.FISH_API_KEY

// ⛔️ For hackathon: pick ONE LLM (OpenAI OR Gemini) to avoid complexity.

export async function transcribeAudioAssemblyAI(audioUrl: string): Promise<string> {
  // For MVP: use AssemblyAI's async transcription API with a Twilio recording URL
  const response = await fetch("https://api.assemblyai.com/v2/transcribe", {
    method: "POST",
    headers: {
      Authorization: ASSEMBLYAI_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
    }),
  })

  const json = await response.json()
  const id = json.id

  // TODO: for production, poll /transcript/{id}; here just return placeholder
  return `Caller said something. (Replace with real polling logic for ${id})`
}

export async function decideReplyAndAction(params: {
  transcript: string
  mode: Mode
  customMessage?: string
}) {
  const { transcript, mode, customMessage } = params

  const systemPrompt = `
You are an AI that answers phone calls on behalf of the user, speaking in their voice.
Current mode: ${mode}.
If mode is "meeting", say the user is in a meeting and offer to reschedule.
If mode is "vacation", say the user is out of town and suggest a later date.
If mode is "off", you should not answer (but this function should not be called then).
Use a polite, concise tone. You can also detect spam (telemarketers).
If spam, set action = "hangup".
If caller wants to schedule something, set action = "calendar_event" and extract a simple date/time summary.
Custom message (optional): ${customMessage ?? "none"}.
Return JSON only with fields: reply, action, calendarSummary, spam.
`

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await resp.json()
  const raw = data.choices?.[0]?.message?.content ?? "{}"
  let parsed: any = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = { reply: "Sorry, something went wrong.", action: "none" }
  }

  return {
    reply: parsed.reply ?? "I'll have the user call you back.",
    action: parsed.action ?? "none",
    calendarSummary: parsed.calendarSummary ?? "",
    spam: Boolean(parsed.spam),
  }
}

export async function synthesizeWithFish(reply: string): Promise<string> {
  // Returns a URL to TTS audio, or base64 — up to you
  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FISH_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_id: process.env.FISH_VOICE_ID,
      text: reply,
      format: "mp3",
    }),
  })

  const json = await res.json()
  // TODO: inspect actual fish audio response shape and adapt
  return json.audio_url ?? ""
}
