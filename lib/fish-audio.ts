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

export interface AudioResult {
  pcmData: Buffer
  sampleRate: number
}

/**
 * Convert text to speech using Fish Audio with OpenAI TTS fallback
 * @param text - The text to convert to speech
 * @returns Audio data with sample rate info
 */
export async function synthesizeSpeech(text: string): Promise<AudioResult> {
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
 * Returns PCM audio properly extracted from WAV with correct sample rate info
 */
async function synthesizeWithFishAudio(text: string): Promise<AudioResult> {
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
    
    // Parse WAV header properly
    const wavHeader = parseWAVHeader(wavBuffer)
    
    if (!wavHeader) {
      throw new Error("Invalid WAV file from Fish Audio")
    }
    
    // Extract PCM data starting after the header
    const pcmData = wavBuffer.slice(wavHeader.dataOffset)
    
    console.log(`✅ Fish Audio TTS: ${wavHeader.sampleRate}Hz, ${wavHeader.bitsPerSample}-bit, ${pcmData.length} bytes`)
    return {
      pcmData,
      sampleRate: wavHeader.sampleRate,
    }
  } catch (error: any) {
    console.error("Fish Audio TTS Error:", error)
    throw error
  }
}

/**
 * Parse WAV file header to find the actual data offset
 */
function parseWAVHeader(buffer: Buffer): { sampleRate: number; bitsPerSample: number; dataOffset: number } | null {
  // Check for RIFF header
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return null
  }

  // Check for WAVE format
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return null
  }

  let offset = 12
  let sampleRate = 0
  let bitsPerSample = 0
  let dataOffset = 0

  // Find fmt and data chunks
  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)

    if (chunkId === 'fmt ') {
      // Parse fmt chunk
      sampleRate = buffer.readUInt32LE(offset + 12)
      bitsPerSample = buffer.readUInt16LE(offset + 22)
    } else if (chunkId === 'data') {
      // Found data chunk
      dataOffset = offset + 8
      break
    }

    offset += 8 + chunkSize
  }

  if (dataOffset === 0 || sampleRate === 0) {
    return null
  }

  return { sampleRate, bitsPerSample, dataOffset }
}

/**
 * Synthesize speech using OpenAI TTS (fallback)
 * Returns PCM audio optimized for phone calls
 */
async function synthesizeWithOpenAI(text: string): Promise<AudioResult> {
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
    return {
      pcmData: buffer,
      sampleRate: 24000, // OpenAI TTS PCM is 24kHz
    }
  } catch (error: any) {
    console.error("OpenAI TTS Error:", error)
    throw new Error(error?.message || "Failed to generate speech")
  }
}

