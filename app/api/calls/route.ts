import { NextResponse } from "next/server"
import { getState } from "@/lib/state"

export async function GET() {
  const { calls } = getState()
  return NextResponse.json({ calls })
}
