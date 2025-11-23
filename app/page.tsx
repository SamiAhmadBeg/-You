"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

type Mode = "normal" | "meeting" | "vacation" | "off"

interface CallLog {
  id: string
  from: string
  time: string
  modeAtTime: Mode
  summary: string
  action?: string
}

interface AppState {
  assistantEnabled: boolean
  mode: Mode
  customMessage?: string
}

export default function HomePage() {
  const [state, setState] = useState<AppState>({
    assistantEnabled: true,
    mode: "normal",
    customMessage: "",
  })

  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchState() {
    const res = await fetch("/api/state")
    const json = await res.json()
    setState(json)
  }

  async function fetchCalls() {
    const res = await fetch("/api/calls")
    const json = await res.json()
    setCalls(json.calls ?? [])
  }

  useEffect(() => {
    ;(async () => {
      await Promise.all([fetchState(), fetchCalls()])
      setLoading(false)
    })()
  }, [])

  async function updateState(patch: Partial<AppState>) {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, ...patch }),
    })
    const json = await res.json()
    setState(json)
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-[#C5050C] animate-pulse" />
          <p className="text-neutral-600 text-sm font-medium">Loading !You</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header with subtle border */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image src="/!Y.png" alt="!You" width={48} height={48} className="w-12 h-12" />
            </div>
          </div>

          {/* UW Madison red status indicator */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all ${
                state.assistantEnabled
                  ? "bg-[#C5050C] border-[#C5050C] text-white shadow-lg shadow-[#C5050C]/20"
                  : "bg-neutral-100 border-neutral-300 text-neutral-600"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  state.assistantEnabled ? "bg-white animate-pulse" : "bg-neutral-400"
                }`}
              />
              <span className="text-sm font-semibold tracking-wide">
                {state.assistantEnabled ? "ACTIVE" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid gap-8 lg:grid-cols-[420px,1fr]">
          {/* Control panel */}
          <div className="space-y-6">
            {/* Assistant toggle card */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-base font-bold text-black mb-1">Assistant Control</h3>
                  <p className="text-sm text-neutral-600">Enable or disable call handling</p>
                </div>
                <button
                  onClick={() => updateState({ assistantEnabled: !state.assistantEnabled })}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all shadow-inner ${
                    state.assistantEnabled ? "bg-[#C5050C]" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                      state.assistantEnabled ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Mode selector with clean grid */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#C5050C]" />
                  Select Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { mode: "normal", label: "Normal", desc: "Handle calls", icon: "✓" },
                      { mode: "meeting", label: "Meeting", desc: "In a meeting", icon: "●" },
                      { mode: "vacation", label: "Vacation", desc: "Out of office", icon: "✈" },
                      { mode: "off", label: "Off", desc: "Direct to VM", icon: "✕" },
                    ] as const
                  ).map(({ mode, label, desc, icon }) => (
                    <button
                      key={mode}
                      onClick={() => updateState({ mode })}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        state.mode === mode
                          ? "bg-[#C5050C] border-[#C5050C] text-white shadow-lg shadow-[#C5050C]/20 scale-[1.02]"
                          : "bg-white border-neutral-200 text-black hover:border-neutral-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{icon}</span>
                        <div className="text-sm font-bold">{label}</div>
                      </div>
                      <div className={`text-xs ${state.mode === mode ? "text-white/80" : "text-neutral-500"}`}>
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom message card */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1 w-1 rounded-full bg-[#C5050C]" />
                <label className="text-base font-bold text-black">Custom Message</label>
              </div>
              <p className="text-sm text-neutral-600 mb-4">Override the default AI response</p>
              <textarea
                rows={5}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:border-[#C5050C] focus:ring-2 focus:ring-[#C5050C]/20 focus:bg-white resize-none transition-all"
                placeholder="e.g., I'm at MadHacks this weekend building something cool! Please text me instead."
                value={state.customMessage ?? ""}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    customMessage: e.target.value,
                  }))
                }
                onBlur={() => updateState({ customMessage: state.customMessage })}
              />
            </div>
          </div>

          {/* Call log with elevated card design */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="border-b border-neutral-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-1 w-1 rounded-full bg-[#C5050C]" />
                    <h2 className="text-base font-bold text-black">Recent Calls</h2>
                  </div>
                  <p className="text-sm text-neutral-600">
                    {calls.length === 0 ? "No calls yet" : `${calls.length} call${calls.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  onClick={fetchCalls}
                  className="text-sm font-medium text-[#C5050C] hover:text-[#A00409] px-4 py-2 rounded-lg hover:bg-neutral-50 transition-all"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto max-h-[700px]">
              {calls.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-black mb-2">No calls yet</p>
                  <p className="text-sm text-neutral-600 max-w-md leading-relaxed">
                    Point your Twilio webhook to{" "}
                    <code className="text-[#C5050C] font-mono text-xs bg-neutral-100 px-2 py-1 rounded">
                      /api/twilio/voice
                    </code>{" "}
                    to start receiving calls
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 hover:shadow-md hover:border-neutral-300 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-bold text-black truncate mb-1">{call.from}</div>
                        <div className="text-xs text-neutral-500">
                          {new Date(call.time).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-neutral-700 bg-white border border-neutral-300 px-3 py-1 rounded-full">
                          {call.modeAtTime}
                        </span>
                        {call.action && (
                          <span className="text-xs font-bold text-[#C5050C] bg-[#C5050C]/10 border border-[#C5050C]/20 px-3 py-1 rounded-full">
                            {call.action}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed line-clamp-2">{call.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer badge */}
      <div className="fixed bottom-6 right-6">
        <div className="bg-white border-2 border-[#C5050C] rounded-full px-4 py-2 shadow-lg shadow-[#C5050C]/20">
          <p className="text-xs font-bold text-[#C5050C] tracking-wide">MADHACKS 2025</p>
        </div>
      </div>
    </main>
  )
}
