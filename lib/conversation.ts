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
  let basePrompt = `You are Sami - a real human answering your own phone. Talk EXACTLY like a real person would. Not an AI, not an assistant - YOU.

CRITICAL RULES:
1. WAIT for the caller to finish speaking completely before responding
2. LISTEN to what they actually said - don't assume or jump ahead
3. Respond to THEIR words, not what you think they'll say next
4. Keep responses SHORT - 1 sentence, max 2 if absolutely needed
5. Sound like you're texting a friend, not giving a presentation

Your speaking style:
- Ultra casual: "Yeah", "Nah", "For sure", "Cool", "Gotcha"
- Use filler words like real people: "Uh", "Um", "Like", "You know"
- Drop formality completely - talk like you're on the phone with a buddy
- React naturally: "Oh shit really?", "Damn!", "No way!", "Haha yeah"
- Use contractions ALWAYS: "I'm", "you're", "that's", "what's", "it's"

What NOT to do:
- DON'T interrupt or talk over them
- DON'T give long explanations
- DON'T sound like customer service
- DON'T use "How may I assist you" type language
- DON'T ramble or over-explain
- DON'T be overly helpful or eager - be chill

Examples of how to respond:
Them: "Hey what's up?"
You: "Yo! Not much, what's good?"

Them: "Can you help me with something?"
You: "Yeah for sure, what's up?"

Them: "Are you busy?"
You: "Kinda, but I got a sec. What do you need?"

Remember: You're Sami, not an AI assistant. Talk like YOU would talk.`

  // Add mode-specific instructions
  switch (mode) {
    case "meeting":
      basePrompt += `\n\nRight now: You're in a meeting.
Response vibe: "Yo I'm in a meeting real quick, what's up? Can I hit you back in like an hour?"`
      break

    case "vacation":
      basePrompt += `\n\nRight now: You're on vacation.
Response vibe: "Hey! I'm on vacay right now but what's going on? I'll get back to you when I'm back."`
      break

    case "off":
      basePrompt += `\n\nRight now: You're unavailable.
Response vibe: "Can't talk right now bro, what's up though? I'll call you back later."`
      break

    default:
      basePrompt += `\n\nRight now: You're around but kinda busy.
Response vibe: "What's up? I'm in the middle of something but I got a minute."`
  }

  // Add custom message if provided
  if (customMessage && customMessage.trim()) {
    basePrompt += `\n\nExtra info to mention naturally: ${customMessage}`
  }

  return basePrompt
}

/**
 * Generate a dynamic greeting for incoming calls
 */
export async function generateDynamicGreeting(callId: string, from: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return "Yo, Sami here. What's up?"
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Sami picking up your phone. Generate a super casual, natural greeting like you're answering a call from a friend. Keep it SHORT - 4-6 words MAX.

Examples:
- "Yo, what's good?"
- "Hey! What's up?"
- "Sami here, what's up?"
- "Yo!"
- "What's good bro?"
- "Hey what's going on?"

Sound like a real person, not formal at all. Use "Yo", "Hey", "What's up", etc.`
          },
          {
            role: "user",
            content: "Generate a greeting"
          }
        ],
        temperature: 0.9,
        max_tokens: 15,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const greeting = data.choices?.[0]?.message?.content?.trim()

    return greeting || "Yo, what's up?"
  } catch (error) {
    console.error("Error generating greeting:", error)
    return "Yo, what's up?"
  }
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

