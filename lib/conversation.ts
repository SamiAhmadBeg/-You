import { getSession, addMessage, getConversationHistory, isProcessing, setProcessing } from "./call-session"
import { getState } from "./state"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/**
 * Process a caller's utterance and generate an AI response
 * @param callId - The call session ID
 * @param transcript - The transcribed text from the caller
 * @returns The AI's response text
 */
export async function processUtterance(callId: string, transcript: string): Promise<string | null> {
  // Check if we're already processing a response
  if (isProcessing(callId)) {
    console.log(`⏳ [${callId}] Already processing, skipping...`)
    return null
  }

  // Mark as processing
  setProcessing(callId, true)

  try {
    const session = getSession(callId)
    if (!session) {
      console.error(`Session ${callId} not found`)
      return null
    }

    // Add caller's message to history
    addMessage(callId, "caller", transcript)

    // Get conversation history
    const history = getConversationHistory(callId, 10)

    // Get current app state for context
    const { mode, customMessage } = getState()

    // Generate AI response
    const aiResponse = await generateAIResponse(history, mode, customMessage)

    // Add AI response to history
    addMessage(callId, "assistant", aiResponse)

    return aiResponse
  } catch (error) {
    console.error(`Error processing utterance for call ${callId}:`, error)
    return "I'm sorry, I'm having trouble understanding. Could you please repeat that?"
  } finally {
    // Mark as not processing
    setProcessing(callId, false)
  }
}

/**
 * Generate an AI response using OpenAI
 */
async function generateAIResponse(
  history: Array<{ role: string; text: string }>,
  mode: string,
  customMessage?: string
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  // Build system prompt based on mode
  const systemPrompt = buildSystemPrompt(mode, customMessage)

  // Build messages array for OpenAI
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role === "caller" ? "user" : "assistant",
      content: msg.text,
    })),
  ]

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 150, // Keep responses concise for phone calls
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const aiReply = data.choices?.[0]?.message?.content?.trim()

    if (!aiReply) {
      throw new Error("No response from OpenAI")
    }

    return aiReply
  } catch (error) {
    console.error("OpenAI API error:", error)
    throw error
  }
}

/**
 * Build system prompt based on mode and custom message
 */
function buildSystemPrompt(mode: string, customMessage?: string): string {
  let basePrompt = `You are Sami. You're a real person answering your own phone. Speak naturally and casually like you're talking to a friend or colleague.

Your personality:
- Casual, friendly, and approachable
- Use natural speech patterns ("Hey!", "What's up?", "Yeah", "Sure thing")
- Keep it SHORT - 1-2 sentences max per response
- Sound human, not like a robot or formal assistant
- Use contractions (I'm, you're, that's, etc.)

Your style:
- Start responses naturally: "Yeah, I'm...", "Oh hey!", "Sure!", "Actually..."
- Don't be overly formal or robotic
- Be helpful but keep it conversational
- Ask one thing at a time

Important:
- This is YOUR phone, so talk like yourself
- Keep responses brief and natural
- No markdown, bullet points, or formal language
- Sound like you're actually on a phone call`

  // Add mode-specific instructions
  switch (mode) {
    case "meeting":
      basePrompt += `\n\nRight now: You're in a meeting and can't really talk.
Say something like: "Hey! I'm actually in a meeting right now. What's up? Can I call you back in like an hour?"`
      break

    case "vacation":
      basePrompt += `\n\nRight now: You're on vacation.
Say something like: "Hey! I'm on vacation right now, but what's going on? I'll get back to you when I'm back next week."`
      break

    case "off":
      basePrompt += `\n\nRight now: You're unavailable.
Say something like: "Hey! Can't talk right now. What's up? I'll hit you back later."`
      break

    default:
      basePrompt += `\n\nRight now: You're available but busy.
Take their info casually: "What's up? I'm kinda in the middle of something, but what do you need?"`
  }

  // Add custom message if provided
  if (customMessage && customMessage.trim()) {
    basePrompt += `\n\nExtra context: ${customMessage}
Work this into the conversation naturally.`
  }

  return basePrompt
}

/**
 * Generate a summary of the call
 * @param callId - The call session ID
 * @returns A summary of the conversation
 */
export async function generateCallSummary(callId: string): Promise<string> {
  const session = getSession(callId)
  if (!session || session.messages.length === 0) {
    return "No conversation recorded."
  }

  const history = session.messages

  // Build transcript
  const transcript = history.map((msg) => `${msg.role}: ${msg.text}`).join("\n")

  const summaryPrompt = `Summarize this phone call in 2-3 concise bullet points:
- Who called
- Why they called (purpose/request)
- Any important details (dates, times, callback info)

Transcript:
${transcript}

Provide ONLY the bullet points, no additional text.`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: summaryPrompt }],
        temperature: 0.5,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    return summary || "Call completed."
  } catch (error) {
    console.error("Error generating summary:", error)
    return "Call completed. Summary unavailable."
  }
}

