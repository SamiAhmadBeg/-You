import { RealtimeTranscript } from "assemblyai"

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!ASSEMBLYAI_API_KEY && !OPENAI_API_KEY) {
  console.warn("⚠️  Neither ASSEMBLYAI_API_KEY nor OPENAI_API_KEY found - transcription will not work")
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
 * Create and manage a real-time streaming transcription session using OpenAI Whisper
 * Falls back from AssemblyAI to OpenAI for better reliability
 */
export class AssemblyAIStream {
  private isConnected: boolean = false
  private options: AssemblyAIStreamOptions
  private audioBuffer: Buffer[] = []
  private processingTimer: NodeJS.Timeout | null = null
  private sessionId: string

  constructor(options: AssemblyAIStreamOptions) {
    this.options = options
    this.sessionId = Math.random().toString(36).substring(7)
  }

  /**
   * Connect to transcription service
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn("Transcription stream already connected")
      return
    }

    try {
      this.isConnected = true
      console.log(`✅ OpenAI Whisper transcription ready: ${this.sessionId}`)
      
      if (this.options.onOpen) {
        this.options.onOpen(this.sessionId)
      }
    } catch (error) {
      console.error("Failed to initialize transcription:", error)
      throw error
    }
  }

  /**
   * Send audio data for transcription
   * Buffers audio and processes in chunks for near-real-time transcription
   */
  sendAudio(audioData: Buffer): void {
    if (!this.isConnected) {
      console.warn("Transcription not connected, cannot send audio")
      return
    }

    // Add to buffer
    this.audioBuffer.push(audioData)

    // Process every 3 seconds of audio for near-real-time transcription
    if (!this.processingTimer) {
      this.processingTimer = setTimeout(() => {
        this.processBufferedAudio()
      }, 3000) // Process every 3 seconds
    }
  }

  /**
   * Process buffered audio with OpenAI Whisper
   */
  private async processBufferedAudio(): Promise<void> {
    if (this.audioBuffer.length === 0) {
      this.processingTimer = null
      return
    }

    try {
      // Combine all buffered audio
      const combinedBuffer = Buffer.concat(this.audioBuffer)
      this.audioBuffer = [] // Clear buffer

      // Skip if buffer is too small (less than 0.5 seconds of audio at 16kHz)
      if (combinedBuffer.length < 16000) {
        this.processingTimer = null
        return
      }

      // Convert PCM to WAV format for Whisper
      const wavBuffer = this.pcmToWav(combinedBuffer, 16000, 1, 16)

      // Transcribe with OpenAI Whisper
      const transcript = await this.transcribeWithWhisper(wavBuffer)

      if (transcript && transcript.trim().length > 0) {
        console.log(`📝 Whisper transcript: "${transcript}"`)
        this.options.onTranscript(transcript, true)
      }
    } catch (error) {
      console.error("Error processing audio:", error)
      if (this.options.onError) {
        this.options.onError(error as Error)
      }
    }

    this.processingTimer = null
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  private async transcribeWithWhisper(audioBuffer: Buffer): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured")
    }

    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: 'audio/wav' })
    formData.append('file', blob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Whisper API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.text || ''
  }

  /**
   * Convert raw PCM to WAV format
   */
  private pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const dataSize = pcmData.length
    const header = Buffer.alloc(44)

    // RIFF header
    header.write('RIFF', 0)
    header.writeUInt32LE(36 + dataSize, 4)
    header.write('WAVE', 8)

    // fmt chunk
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16) // fmt chunk size
    header.writeUInt16LE(1, 20) // audio format (1 = PCM)
    header.writeUInt16LE(channels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28) // byte rate
    header.writeUInt16LE(channels * (bitsPerSample / 8), 32) // block align
    header.writeUInt16LE(bitsPerSample, 34)

    // data chunk
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return Buffer.concat([header, pcmData])
  }

  /**
   * Close the transcription connection
   */
  async close(): Promise<void> {
    if (!this.isConnected) {
      return
    }

    try {
      // Process any remaining buffered audio
      if (this.audioBuffer.length > 0) {
        await this.processBufferedAudio()
      }

      if (this.processingTimer) {
        clearTimeout(this.processingTimer)
        this.processingTimer = null
      }

      this.isConnected = false
      console.log("🔌 Transcription connection closed")
      
      if (this.options.onClose) {
        this.options.onClose()
      }
    } catch (error) {
      console.error("Error closing transcription connection:", error)
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
 * Factory function to create a transcription stream
 */
export function createAssemblyAIStream(options: AssemblyAIStreamOptions): AssemblyAIStream {
  return new AssemblyAIStream(options)
}

