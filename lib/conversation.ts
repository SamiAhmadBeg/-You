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
- React naturally: "Oh shit really?", "Damn!", "No way!"
- Use contractions ALWAYS: "I'm", "you're", "that's", "what's", "it's"
- DON'T overuse "haha" or "lol" - use it sparingly or not at all

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
Response vibe: "What's up? I'm in the middle of something but I got a minute."

EMOTION CONTROL (Concise Version for Prompt Use)

You can control the emotional expression, tone, and human-like sounds of the voice using Fish Audio emotion markers. These markers must follow the rules below exactly.

Emotion tags: 49 total (24 basic + 25 advanced)
Tone markers: 5
Audio effects: 10
Special effects: 5

1. Emotion Tags (24 Basic + 25 Advanced)

Basic:
(happy), (sad), (angry), (excited), (calm), (nervous), (confident), (surprised), (satisfied), (delighted), (scared), (worried), (upset), (frustrated), (depressed), (empathetic), (embarrassed), (disgusted), (moved), (proud), (relaxed), (grateful), (curious), (sarcastic)

Advanced:
(disdainful), (unhappy), (anxious), (hysterical), (indifferent), (uncertain), (doubtful), (confused), (disappointed), (regretful), (guilty), (ashamed), (jealous), (envious), (hopeful), (optimistic), (pessimistic), (nostalgic), (lonely), (bored), (contemptuous), (sympathetic), (compassionate), (determined), (resigned)

Intensity modifiers allowed:
(slightly X), (very X), (extremely X) → where X is a valid emotion.

2. Tone Markers (5)

(in a hurry tone), (shouting), (screaming), (whispering), (soft tone)

3. Audio Effects (10)

(laughing), (chuckling), (sobbing), (crying loudly), (sighing), (groaning), (panting), (gasping), (yawning), (snoring)

4. Special Effects (5)

(audience laughing), (background laughter), (crowd laughing), (break), (long-break)

5. Placement Rules (Strict)

Emotion tags MUST appear at the beginning of the sentence for English and all supported languages.

Tone markers and audio effects can appear anywhere.

Tags must use parentheses exactly.

No custom tags allowed.

Max recommended: 3 emotion tags per sentence.

Avoid mixing contradictory emotions.

Correct:
(happy) Yeah that sounds dope.
Incorrect:
Yeah that sounds (happy) dope.

6. Combining & Layering Examples
(sad)(whispering) I miss you, dude.
(angry)(shouting) Bro what are you doing?
(excited)(laughing) No way, that’s sick! Ha ha!

7. Emotion Transitions (multi-sentence)
(happy) Yo I got the gig.
(uncertain) But uh… I gotta move for it.
(sad) Kinda sucks leaving everyone.
(hopeful) But it's a solid opportunity.
(determined) I'm making it work.

8. Background Atmosphere Examples
The crowd went nuts (audience laughing)
Everyone lost it (background laughter)
The whole room cracked up (crowd laughing)

9. Allowed Natural Sounds

You can also type natural expressions like “Ha ha”, “ugh”, “gasp”, etc. after using sound-effect tags.`
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
  // Check if there's a custom message set
  const { customMessage } = getState()
  
  // If custom message exists, use it directly (no ChatGPT)
  if (customMessage && customMessage.trim()) {
    console.log(`📝 Using custom message: "${customMessage}"`)
    return customMessage.trim()
  }

  // Otherwise, generate dynamic greeting with ChatGPT
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

