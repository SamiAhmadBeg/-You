import { NextResponse } from "next/server"
import { AssemblyAI } from "assemblyai"

export const runtime = "nodejs"

/**
 * Test endpoint to verify AssemblyAI API key and connection
 * GET /api/test-assemblyai
 */
export async function GET() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "ASSEMBLYAI_API_KEY not found in environment variables",
        message: "Please add ASSEMBLYAI_API_KEY to your .env.local file",
      },
      { status: 500 }
    )
  }

  console.log("🧪 Testing AssemblyAI connection...")
  console.log(`API Key: ${apiKey.substring(0, 10)}...`)

  try {
    // Initialize AssemblyAI client
    const client = new AssemblyAI({
      apiKey,
    })

    // Try to create a real-time transcriber to test the connection
    console.log("Creating real-time transcriber...")

    const transcriber = client.realtime.transcriber({
      sampleRate: 16_000,
      token: apiKey, // Explicitly pass the token
    })

    // Set up event handlers
    let sessionId: string | null = null
    let connectionSucceeded = false

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout after 5 seconds"))
      }, 5000)

      transcriber.on("open", ({ sessionId: id }: { sessionId: string }) => {
        sessionId = id
        connectionSucceeded = true
        console.log(`✅ Connected! Session ID: ${id}`)
        clearTimeout(timeout)
        resolve()
      })

      transcriber.on("error", (error: Error) => {
        console.error("❌ Connection error:", error)
        clearTimeout(timeout)
        reject(error)
      })

      // Connect
      transcriber.connect().catch(reject)
    })

    // Close the connection
    await transcriber.close()

    return NextResponse.json({
      success: true,
      message: "AssemblyAI connection successful!",
      sessionId,
      apiKeyPrefix: apiKey.substring(0, 10) + "...",
    })
  } catch (error: any) {
    console.error("❌ AssemblyAI test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        details: error.toString(),
        apiKeyPrefix: apiKey.substring(0, 10) + "...",
        troubleshooting: [
          "Verify your API key is correct at https://www.assemblyai.com/app",
          "Check if your account has credits",
          "Make sure the API key has real-time transcription permissions",
        ],
      },
      { status: 500 }
    )
  }
}

