import { FishAudioClient } from "fish-audio"

const FISH_API_KEY = process.env.FISH_API_KEY

// Debug: Log the API key status (first 8 chars only for security)
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
 * Convert text to speech using Fish Audio
 * @param text - The text to convert to speech
 * @returns Buffer containing the audio data (MP3 format)
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  try {
    // Validate API key
    if (!FISH_API_KEY) {
      throw new Error(
        "FISH_API_KEY is not set. Please add it to your .env.local file. Get your API key from: https://fish.audio/go?s=1&b=r"
      )
    }

    // Call Fish Audio TTS API with proper parameters
    const audioStream = await fishAudio.textToSpeech.convert({
      text,
      format: "mp3",
      // Use your cloned voice if FISH_VOICE_ID is set
      reference_id: process.env.FISH_VOICE_ID,
    })

    // Convert ReadableStream to Buffer
    const reader = audioStream.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    return buffer
  } catch (error: any) {
    console.error("Fish Audio TTS Error:", error)

    // Provide helpful error messages
    if (error?.statusCode === 402) {
      throw new Error(
        "Fish Audio API error: Invalid API key or insufficient balance. Please check your API key and account credits at https://fish.audio"
      )
    }

    if (error?.statusCode === 401) {
      throw new Error("Fish Audio API error: Invalid API key. Please check your FISH_API_KEY in .env.local")
    }

    throw new Error(error?.message || "Failed to generate speech")
  }
}

