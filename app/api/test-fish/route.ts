import { NextResponse } from "next/server"
import { synthesizeSpeech } from "@/lib/fish-audio"

export const runtime = "nodejs"

/**
 * Test endpoint to verify Fish Audio API key and TTS
 * GET /api/test-fish
 */
export async function GET() {
  const apiKey = process.env.FISH_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "FISH_API_KEY not found in environment variables",
        message: "Please add FISH_API_KEY to your .env.local file",
      },
      { status: 500 }
    )
  }

  console.log("🧪 Testing Fish Audio TTS...")
  console.log(`API Key: ${apiKey.substring(0, 8)}...`)

  try {
    // Try to generate a short audio sample
    const testText = "This is a test of the Fish Audio text to speech system."

    console.log(`Generating TTS for: "${testText}"`)

    const audioBuffer = await synthesizeSpeech(testText)

    console.log(`✅ Generated ${audioBuffer.length} bytes of audio`)

    return NextResponse.json({
      success: true,
      message: "Fish Audio TTS successful!",
      audioSizeBytes: audioBuffer.length,
      apiKeyPrefix: apiKey.substring(0, 8) + "...",
      testText,
    })
  } catch (error: any) {
    console.error("❌ Fish Audio test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        details: error.toString(),
        apiKeyPrefix: apiKey.substring(0, 8) + "...",
        troubleshooting: [
          "Verify your API key is correct at https://fish.audio",
          "Check if your account has credits (you need at least 8000 credits)",
          "Make sure the API key format is correct (32-character hex string)",
          "Try generating a new API key if this one doesn't work",
        ],
      },
      { status: 500 }
    )
  }
}

