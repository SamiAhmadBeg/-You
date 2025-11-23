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
  // Try Fish Audio first (better quality)
  if (FISH_API_KEY) {
    try {
      console.log("🎵 Attempting Fish Audio TTS...")
      return await synthesizeWithFishAudio(text)
    } catch (error) {
      console.error("❌ Fish Audio TTS failed, falling back to OpenAI:", error)
    }
  } else {
    console.log("⚠️ FISH_API_KEY not set, using OpenAI TTS")
  }

  // Fallback to OpenAI TTS
  console.log("🔄 Using OpenAI TTS fallback")
  return await synthesizeWithOpenAI(text)
}

/**
 * Synthesize speech using Fish Audio
 * Returns PCM audio extracted from WAV
 */
async function synthesizeWithFishAudio(text: string): Promise<Buffer> {
  try {
    if (!FISH_API_KEY) {
      throw new Error("FISH_API_KEY is not set")
    }

    // Request WAV format (contains PCM data)
    const audioStream = await fishAudio.textToSpeech.convert({
      text,
      format: "wav",
      reference_id: process.env.FISH_VOICE_ID,
    })

    const reader = audioStream.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }

    const wavBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    
    // Extract PCM data from WAV (skip 44-byte header)
    const pcmData = wavBuffer.slice(44)
    
    console.log("✅ Fish Audio TTS successful (WAV/PCM format)")
    return pcmData
  } catch (error: any) {
    console.error("Fish Audio TTS Error:", error)
    throw error
  }
}

/**
 * Synthesize speech using OpenAI TTS (fallback)
 * Returns PCM audio optimized for phone calls
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
        model: "tts-1-hd", // Use HD model for better quality
        voice: "echo", // Natural male voice (clearer than alloy)
        input: text,
        speed: 1.0,
        response_format: "pcm", // Request raw PCM instead of MP3
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI TTS error: ${response.status} - ${error}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log("✅ OpenAI TTS-HD successful (PCM format)")
    return buffer
  } catch (error: any) {
    console.error("OpenAI TTS Error:", error)
    throw new Error(error?.message || "Failed to generate speech")
  }
}

