import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Test endpoint to verify OpenAI API key
 * GET /api/test-openai
 */
export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "OPENAI_API_KEY not found in environment variables",
        message: "Please add OPENAI_API_KEY to your .env.local file",
      },
      { status: 500 }
    )
  }

  console.log("🧪 Testing OpenAI API...")
  console.log(`API Key: ${apiKey.substring(0, 10)}...`)

  try {
    // Test with a simple completion
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "Say 'API test successful' and nothing else.",
          },
        ],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content

    console.log(`✅ OpenAI response: ${reply}`)

    return NextResponse.json({
      success: true,
      message: "OpenAI API connection successful!",
      response: reply,
      model: data.model,
      apiKeyPrefix: apiKey.substring(0, 10) + "...",
    })
  } catch (error: any) {
    console.error("❌ OpenAI test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        details: error.toString(),
        apiKeyPrefix: apiKey.substring(0, 10) + "...",
        troubleshooting: [
          "Verify your API key is correct at https://platform.openai.com/api-keys",
          "Check if your account has credits",
          "Make sure the API key has not expired",
          "Try using gpt-3.5-turbo if gpt-4o-mini doesn't work",
        ],
      },
      { status: 500 }
    )
  }
}

