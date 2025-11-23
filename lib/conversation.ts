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
  let basePrompt = `You are an AI phone assistant answering calls on behalf of the user.

Your role:
- Greet callers professionally and politely
- Ask for their name and reason for calling
- Gather key information (what they want, when they'd like a callback, contact info)
- Keep responses SHORT and conversational (1-2 sentences max)
- Speak naturally as if on a phone call
- Be friendly but efficient

Important:
- This is a PHONE CALL - keep responses brief and clear
- Don't use markdown, bullet points, or long paragraphs
- Speak in complete sentences but keep them short
- Ask one question at a time`

  // Add mode-specific instructions
  switch (mode) {
    case "meeting":
      basePrompt += `\n\nCurrent status: The user is currently in a meeting and cannot take calls.
Tell callers this and offer to take a message or schedule a callback for later.`
      break

    case "vacation":
      basePrompt += `\n\nCurrent status: The user is on vacation and out of office.
Tell callers this and offer to take their information for when the user returns.`
      break

    case "off":
      basePrompt += `\n\nCurrent status: The user has disabled call handling.
Politely inform callers and suggest they leave a voicemail or call back later.`
      break

    default:
      basePrompt += `\n\nCurrent status: Normal operations. The user is available but busy.
Take the caller's information and let them know the user will get back to them.`
  }

  // Add custom message if provided
  if (customMessage && customMessage.trim()) {
    basePrompt += `\n\nCustom message from user: "${customMessage}"
Incorporate this message naturally into your conversation when appropriate.`
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

