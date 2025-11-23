import { AssemblyAI, RealtimeTranscript } from "assemblyai"

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

if (!ASSEMBLYAI_API_KEY) {
  console.warn("⚠️  ASSEMBLYAI_API_KEY not found in environment variables")
}

export interface TranscriptCallback {
  (transcript: string, isFinal: boolean): void
}

export interface AssemblyAIStreamOptions {
  onTranscript: TranscriptCallback
  onError?: (error: Error) => void
  onOpen?: (sessionId: string) => void
  onClose?: () => void
}

/**
 * Create and manage an AssemblyAI real-time streaming transcription session
 */
export class AssemblyAIStream {
  private client: AssemblyAI
  private transcriber: any
  private isConnected: boolean = false
  private options: AssemblyAIStreamOptions

  constructor(options: AssemblyAIStreamOptions) {
    this.options = options

    this.client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY || "",
    })
  }

  /**
   * Connect to AssemblyAI streaming service
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn("AssemblyAI stream already connected")
      return
    }

    try {
      // Create a streaming transcriber
      this.transcriber = this.client.realtime.transcriber({
        sampleRate: 16_000,
        token: ASSEMBLYAI_API_KEY, // Explicitly pass token
      })

      // Set up event handlers
      this.transcriber.on("open", ({ sessionId }: { sessionId: string }) => {
        console.log(`✅ AssemblyAI session opened: ${sessionId}`)
        this.isConnected = true
        if (this.options.onOpen) {
          this.options.onOpen(sessionId)
        }
      })

      this.transcriber.on("error", (error: Error) => {
        console.error("❌ AssemblyAI error:", error)
        if (this.options.onError) {
          this.options.onError(error)
        }
      })

      this.transcriber.on("close", (code: number, reason: string) => {
        console.log(`AssemblyAI session closed: ${code} - ${reason}`)
        this.isConnected = false
        if (this.options.onClose) {
          this.options.onClose()
        }
      })

      this.transcriber.on("transcript", (transcript: RealtimeTranscript) => {
        if (!transcript.text) {
          return
        }

        const isFinal = transcript.message_type === "FinalTranscript"

        if (isFinal) {
          console.log("📝 Final transcript:", transcript.text)
        } else {
          console.log("📝 Partial transcript:", transcript.text)
        }

        this.options.onTranscript(transcript.text, isFinal)
      })

      // Connect to the service
      await this.transcriber.connect()

      console.log("🎤 AssemblyAI streaming ready")
    } catch (error) {
      console.error("Failed to connect to AssemblyAI:", error)
      throw error
    }
  }

  /**
   * Send audio data to AssemblyAI for transcription
   * @param audioData - PCM 16-bit audio data at 16kHz
   */
  sendAudio(audioData: Buffer): void {
    if (!this.isConnected || !this.transcriber) {
      console.warn("AssemblyAI not connected, cannot send audio")
      return
    }

    try {
      this.transcriber.sendAudio(audioData)
    } catch (error) {
      console.error("Error sending audio to AssemblyAI:", error)
      if (this.options.onError) {
        this.options.onError(error as Error)
      }
    }
  }

  /**
   * Close the AssemblyAI streaming connection
   */
  async close(): Promise<void> {
    if (!this.isConnected || !this.transcriber) {
      return
    }

    try {
      await this.transcriber.close()
      this.isConnected = false
      console.log("🔌 AssemblyAI connection closed")
    } catch (error) {
      console.error("Error closing AssemblyAI connection:", error)
    }
  }

  /**
   * Check if the stream is connected
   */
  isActive(): boolean {
    return this.isConnected
  }
}

/**
 * Factory function to create an AssemblyAI stream
 */
export function createAssemblyAIStream(options: AssemblyAIStreamOptions): AssemblyAIStream {
  return new AssemblyAIStream(options)
}

