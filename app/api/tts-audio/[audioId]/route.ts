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
  { params }: { params: { audioId: string } }
) {
  const audioId = params.audioId
  const cached = audioCache.get(audioId)

  if (!cached) {
    return new NextResponse("Audio not found or expired", { status: 404 })
  }

  return new NextResponse(cached.buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=300",
    },
  })
}

/**
 * Store audio in cache and return the URL
 */
export function storeAudio(buffer: Buffer): string {
  const audioId = crypto.randomUUID()
  audioCache.set(audioId, { buffer, timestamp: Date.now() })
  return audioId
}

