import type { AssemblyAIStream } from "./assemblyai-stream"
import type { WebSocket } from "ws"

export interface Message {
  role: "caller" | "assistant"
  text: string
  timestamp: Date
}

export interface CallSession {
  callId: string
  callerPhone: string
  startTime: Date
  endTime?: Date
  status: "active" | "completed" | "failed"
  messages: Message[]
  assemblyAIStream?: AssemblyAIStream
  twilioWebSocket?: WebSocket
  streamSid?: string
  isProcessing: boolean // Flag to prevent concurrent LLM calls
}

// In-memory store for active call sessions
const activeSessions = new Map<string, CallSession>()

/**
 * Create a new call session
 */
export function createSession(callId: string, callerPhone: string): CallSession {
  const session: CallSession = {
    callId,
    callerPhone,
    startTime: new Date(),
    status: "active",
    messages: [],
    isProcessing: false,
  }

  activeSessions.set(callId, session)
  console.log(`📞 Created session for call ${callId} from ${callerPhone}`)

  return session
}

/**
 * Get an existing call session
 */
export function getSession(callId: string): CallSession | undefined {
  return activeSessions.get(callId)
}

/**
 * Update a call session
 */
export function updateSession(callId: string, updates: Partial<CallSession>): void {
  const session = activeSessions.get(callId)
  if (session) {
    Object.assign(session, updates)
  }
}

/**
 * Add a message to the call session
 */
export function addMessage(callId: string, role: "caller" | "assistant", text: string): void {
  const session = activeSessions.get(callId)
  if (session) {
    session.messages.push({
      role,
      text,
      timestamp: new Date(),
    })
    console.log(`💬 [${callId}] ${role}: ${text}`)
  }
}

/**
 * Get conversation history for a call (last N messages)
 */
export function getConversationHistory(callId: string, limit: number = 10): Message[] {
  const session = activeSessions.get(callId)
  if (!session) {
    return []
  }

  // Return the last N messages
  return session.messages.slice(-limit)
}

/**
 * End a call session
 */
export async function endSession(callId: string): Promise<void> {
  const session = activeSessions.get(callId)
  if (!session) {
    return
  }

  session.endTime = new Date()
  session.status = "completed"

  // Close AssemblyAI connection if active
  if (session.assemblyAIStream) {
    await session.assemblyAIStream.close()
  }

  // Close Twilio WebSocket if active
  if (session.twilioWebSocket) {
    session.twilioWebSocket.close()
  }

  console.log(`📴 Ended session for call ${callId}`)

  // Keep session in memory for a bit for retrieval, then clean up
  setTimeout(() => {
    activeSessions.delete(callId)
    console.log(`🗑️  Cleaned up session ${callId}`)
  }, 60000) // Keep for 1 minute after call ends
}

/**
 * Get all active sessions (for debugging)
 */
export function getAllActiveSessions(): CallSession[] {
  return Array.from(activeSessions.values())
}

/**
 * Mark session as processing (to prevent concurrent LLM calls)
 */
export function setProcessing(callId: string, isProcessing: boolean): void {
  const session = activeSessions.get(callId)
  if (session) {
    session.isProcessing = isProcessing
  }
}

/**
 * Check if session is currently processing
 */
export function isProcessing(callId: string): boolean {
  const session = activeSessions.get(callId)
  return session?.isProcessing ?? false
}

