import { NextRequest, NextResponse } from "next/server"

// In-memory storage for audio files (expires after 5 minutes)
const audioCache = new Map<string, { buffer: Buffer; timestamp: number }>()

// Clean up old audio files every minute
setInterval(() => {
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  
  for (const [key, value] of audioCache.entries()) {
    if (now - value.timestamp > fiveMinutes) {
      audioCache.delete(key)
    }
  }
}, 60000)

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ audioId: string }> }
) {
  const { audioId } = await context.params
  const cached = audioCache.get(audioId)

  console.log(`🎵 Audio request for ${audioId}: ${cached ? 'found' : 'not found'}`)

  if (!cached) {
    console.error(`❌ Audio ${audioId} not found in cache`)
    return new NextResponse("Audio not found or expired", { status: 404 })
  }

  console.log(`✅ Serving audio ${audioId}: ${cached.buffer.length} bytes`)
  return new NextResponse(cached.buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": cached.buffer.length.toString(),
      "Cache-Control": "public, max-age=300",
    },
  })
}

/**
 * Store audio in cache and return the audio ID
 */
export function storeAudio(buffer: Buffer): string {
  const audioId = crypto.randomUUID()
  audioCache.set(audioId, { buffer, timestamp: Date.now() })
  console.log(`💾 Stored audio ${audioId}: ${buffer.length} bytes`)
  return audioId
}

