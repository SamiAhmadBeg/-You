import { type NextRequest, NextResponse } from "next/server"
import { getState, updateState, type Mode } from "@/lib/state"

export async function GET() {
  return NextResponse.json(getState())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { assistantEnabled, mode, customMessage } = body as {
    assistantEnabled?: boolean
    mode?: Mode
    customMessage?: string
  }

  updateState({
    assistantEnabled: assistantEnabled ?? getState().assistantEnabled,
    mode: (mode ?? getState().mode) as Mode,
    customMessage: customMessage ?? getState().customMessage,
  })

  return NextResponse.json(getState())
}
