import { type NextRequest, NextResponse } from "next/server"
import { synthesizeSpeech } from "@/lib/fish-audio"

export const runtime = "nodejs" // Ensure Node.js runtime for Fish Audio SDK

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text } = body

    // Validate input
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'text' field" }, { status: 400 })
    }

    if (text.length === 0) {
      return NextResponse.json({ error: "Text cannot be empty" }, { status: 400 })
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long (max 5000 characters)" }, { status: 400 })
    }

    // Generate TTS audio
    console.log(`🎤 Generating speech for: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`)

    const audioBuffer = await synthesizeSpeech(text)

    console.log(`✅ Generated ${audioBuffer.length} bytes of audio`)

    // Return as MP3
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Content-Disposition": 'inline; filename="speech.mp3"',
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("❌ TTS Error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate speech",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

