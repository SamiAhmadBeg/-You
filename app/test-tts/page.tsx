"use client"

import { useState } from "react"
import Image from "next/image"

export default function TestTTSPage() {
  const [text, setText] = useState("")
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!text.trim()) {
      setError("Please enter some text")
      return
    }

    setLoading(true)
    setError(null)
    setAudioSrc(null)

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate speech")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setAudioSrc(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("TTS Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const sampleTexts = [
    "Hi, this is your AI assistant. How can I help you today?",
    "I'm currently in a meeting. Please leave a message and I'll get back to you soon.",
    "Welcome to MadHacks 2025! Let's build something amazing.",
    "Testing Fish Audio text-to-speech with real-time voice generation.",
  ]

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image src="/!Y.png" alt="!You" width={48} height={48} className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black">Fish Audio TTS Test</h1>
              <p className="text-sm text-neutral-600">Test your text-to-speech integration</p>
            </div>
          </div>

          <a
            href="/"
            className="text-sm font-medium text-[#C5050C] hover:text-[#A00409] px-4 py-2 rounded-lg hover:bg-neutral-50 transition-all"
          >
            ← Back to Dashboard
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-1 w-1 rounded-full bg-[#C5050C]" />
                <label htmlFor="text" className="text-base font-bold text-black">
                  Enter Text to Speak
                </label>
              </div>

              <textarea
                id="text"
                rows={6}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:border-[#C5050C] focus:ring-2 focus:ring-[#C5050C]/20 focus:bg-white resize-none transition-all"
                placeholder="Type or paste text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={5000}
              />

              <div className="flex justify-between items-center mt-2 text-xs text-neutral-500">
                <span>Max 5000 characters</span>
                <span>{text.length} / 5000</span>
              </div>
            </div>

            {/* Sample texts */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-1 w-1 rounded-full bg-[#C5050C]" />
                <label className="text-sm font-semibold text-neutral-700">Quick Examples</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sampleTexts.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setText(sample)}
                    className="text-left text-xs p-3 bg-neutral-50 border border-neutral-200 rounded-lg hover:border-[#C5050C] hover:bg-[#C5050C]/5 transition-all"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                loading || !text.trim()
                  ? "bg-neutral-300 cursor-not-allowed"
                  : "bg-[#C5050C] hover:bg-[#A00409] shadow-lg shadow-[#C5050C]/20 hover:shadow-xl"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Generating Speech...
                </span>
              ) : (
                "🎤 Generate Speech"
              )}
            </button>
          </form>

          {/* Error message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-bold">⚠️</span>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Audio player */}
          {audioSrc && (
            <div className="mt-6 p-6 bg-gradient-to-br from-[#C5050C]/5 to-[#C5050C]/10 border border-[#C5050C]/20 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-1 w-1 rounded-full bg-[#C5050C]" />
                <h3 className="text-base font-bold text-black">Generated Speech</h3>
              </div>

              <audio controls src={audioSrc} className="w-full" autoPlay>
                Your browser does not support the audio element.
              </audio>

              <div className="mt-4 flex gap-2">
                <a
                  href={audioSrc}
                  download="speech.mp3"
                  className="flex-1 text-center px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-black hover:bg-neutral-50 transition-all"
                >
                  💾 Download MP3
                </a>
                <button
                  onClick={() => {
                    const audio = document.querySelector("audio")
                    if (audio) audio.play()
                  }}
                  className="flex-1 px-4 py-2 bg-[#C5050C] text-white rounded-lg text-sm font-medium hover:bg-[#A00409] transition-all"
                >
                  ▶️ Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="mt-8 bg-neutral-50 border border-neutral-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h3 className="text-sm font-bold text-black mb-2">How to Use</h3>
              <ul className="text-xs text-neutral-700 space-y-1 list-disc list-inside">
                <li>Enter or paste any text you want to convert to speech</li>
                <li>Click "Generate Speech" to create audio using Fish Audio</li>
                <li>Play the generated audio directly or download it as MP3</li>
                <li>Use the quick examples to test different phrases</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer badge */}
      <div className="fixed bottom-6 right-6">
        <div className="bg-white border-2 border-[#C5050C] rounded-full px-4 py-2 shadow-lg shadow-[#C5050C]/20">
          <p className="text-xs font-bold text-[#C5050C] tracking-wide">FISH AUDIO TTS</p>
        </div>
      </div>
    </main>
  )
}

