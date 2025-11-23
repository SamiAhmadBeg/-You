import { FishAudioClient } from "fish-audio"

const FISH_API_KEY = process.env.FISH_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Debug: Log the API key status
if (!FISH_API_KEY) {
  console.error("❌ FISH_API_KEY not found in environment variables")
} else {
  console.log("✅ FISH_API_KEY loaded")
}

// Initialize Fish Audio client
const fishAudio = new FishAudioClient({
  apiKey: FISH_API_KEY || "",
})

/**
 * Convert text to speech using Fish Audio with OpenAI TTS fallback
 * @param text - The text to convert to speech
 * @returns Buffer containing the audio data (MP3 format)
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  // Try Fish Audio first if Voice ID is set (for voice cloning)
  if (FISH_API_KEY && process.env.FISH_VOICE_ID) {
    try {
      return await synthesizeWithFishAudio(text)
    } catch (error) {
      console.error("Fish Audio TTS failed, falling back to OpenAI:", error)
    }
  }

  // Fallback to OpenAI TTS (more reliable for default voices)
  return await synthesizeWithOpenAI(text)
}

/**
 * Synthesize speech using Fish Audio
 */
async function synthesizeWithFishAudio(text: string): Promise<Buffer> {
  try {
    if (!FISH_API_KEY) {
      throw new Error("FISH_API_KEY is not set")
    }

    const audioStream = await fishAudio.textToSpeech.convert({
      text,
      format: "mp3",
      reference_id: process.env.FISH_VOICE_ID,
    })

    const reader = audioStream.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    console.log("✅ Fish Audio TTS successful")
    return buffer
  } catch (error: any) {
    console.error("Fish Audio TTS Error:", error)
    throw error
  }
}

/**
 * Synthesize speech using OpenAI TTS (fallback)
 */
async function synthesizeWithOpenAI(text: string): Promise<Buffer> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set")
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "alloy", // Natural male voice (change to: echo, fable, onyx, nova, shimmer)
        input: text,
        speed: 1.0,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI TTS error: ${response.status} - ${error}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log("✅ OpenAI TTS successful")
    return buffer
  } catch (error: any) {
    console.error("OpenAI TTS Error:", error)
    throw new Error(error?.message || "Failed to generate speech")
  }
}

