"use client"

import { useState } from "react"
import Image from "next/image"

interface TestResult {
  name: string
  status: "idle" | "testing" | "success" | "error"
  message?: string
  details?: any
  error?: string
}

export default function TestAPIPage() {
  const [results, setResults] = useState<TestResult[]>([
    { name: "AssemblyAI", status: "idle" },
    { name: "OpenAI", status: "idle" },
    { name: "Fish Audio", status: "idle" },
  ])

  const [testing, setTesting] = useState(false)

  const testAPI = async (api: string, endpoint: string, index: number) => {
    // Update status to testing
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: "testing" as const } : r))
    )

    try {
      const response = await fetch(endpoint)
      const data = await response.json()

      if (data.success) {
        setResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? {
                  ...r,
                  status: "success" as const,
                  message: data.message,
                  details: data,
                }
              : r
          )
        )
      } else {
        setResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? {
                  ...r,
                  status: "error" as const,
                  error: data.error,
                  details: data,
                }
              : r
          )
        )
      }
    } catch (error: any) {
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                status: "error" as const,
                error: error.message || "Network error",
              }
            : r
        )
      )
    }
  }

  const testAll = async () => {
    setTesting(true)

    // Test sequentially
    await testAPI("AssemblyAI", "/api/test-assemblyai", 0)
    await testAPI("OpenAI", "/api/test-openai", 1)
    await testAPI("Fish Audio", "/api/test-fish", 2)

    setTesting(false)
  }

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "idle":
        return "⚪"
      case "testing":
        return "🔄"
      case "success":
        return "✅"
      case "error":
        return "❌"
    }
  }

  const getStatusColor = (status: TestResult["status"]) => {
    switch (status) {
      case "idle":
        return "text-neutral-500"
      case "testing":
        return "text-blue-600"
      case "success":
        return "text-green-600"
      case "error":
        return "text-red-600"
    }
  }

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
              <h1 className="text-xl font-bold text-black">API Configuration Test</h1>
              <p className="text-sm text-neutral-600">Verify all API keys are working</p>
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
        {/* Test button */}
        <div className="mb-8">
          <button
            onClick={testAll}
            disabled={testing}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
              testing
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-[#C5050C] hover:bg-[#A00409] shadow-lg shadow-[#C5050C]/20 hover:shadow-xl"
            }`}
          >
            {testing ? (
              <span className="flex items-center justify-center gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Testing APIs...
              </span>
            ) : (
              "🧪 Test All APIs"
            )}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={result.name}
              className="bg-white border-2 border-neutral-200 rounded-xl p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getStatusIcon(result.status)}</span>
                  <div>
                    <h3 className="text-lg font-bold text-black">{result.name}</h3>
                    <p className={`text-sm font-medium ${getStatusColor(result.status)}`}>
                      {result.status === "idle" && "Not tested yet"}
                      {result.status === "testing" && "Testing..."}
                      {result.status === "success" && "Connected successfully!"}
                      {result.status === "error" && "Connection failed"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const endpoints: Record<string, string> = {
                      AssemblyAI: "/api/test-assemblyai",
                      OpenAI: "/api/test-openai",
                      "Fish Audio": "/api/test-fish",
                    }
                    testAPI(result.name, endpoints[result.name], index)
                  }}
                  disabled={result.status === "testing"}
                  className="text-sm px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium transition-all"
                >
                  Test Again
                </button>
              </div>

              {/* Success message */}
              {result.status === "success" && result.message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                  <p className="text-sm text-green-800 font-medium">{result.message}</p>
                  {result.details && (
                    <div className="mt-2 text-xs text-green-700 font-mono">
                      {result.details.apiKeyPrefix && <p>Key: {result.details.apiKeyPrefix}</p>}
                      {result.details.sessionId && <p>Session: {result.details.sessionId}</p>}
                      {result.details.audioSizeBytes && (
                        <p>Audio: {result.details.audioSizeBytes} bytes</p>
                      )}
                      {result.details.model && <p>Model: {result.details.model}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Error message */}
              {result.status === "error" && result.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-bold mb-2">❌ {result.error}</p>
                  {result.details?.troubleshooting && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-red-700 mb-1">Troubleshooting:</p>
                      <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                        {result.details.troubleshooting.map((tip: string, i: number) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.details?.apiKeyPrefix && (
                    <p className="text-xs text-red-600 font-mono mt-2">
                      Key: {result.details.apiKeyPrefix}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-blue-900 mb-3">📋 Before Testing:</h3>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>
              Make sure you have a <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code>{" "}
              file in your project root
            </li>
            <li>Add all required API keys to the file</li>
            <li>
              <strong>Restart your dev server</strong> (environment variables are loaded at startup)
            </li>
            <li>Click "Test All APIs" above</li>
          </ol>
        </div>

        {/* Environment variables guide */}
        <div className="mt-6 bg-neutral-50 border border-neutral-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-black mb-3">🔑 Required Environment Variables:</h3>
          <pre className="text-xs font-mono bg-white border border-neutral-300 rounded-lg p-4 overflow-x-auto">
            {`# .env.local

ASSEMBLYAI_API_KEY=your_assemblyai_key_here
OPENAI_API_KEY=your_openai_key_here
FISH_API_KEY=your_fish_audio_key_here

# Also needed for full functionality:
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token`}
          </pre>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-6 right-6">
        <div className="bg-white border-2 border-[#C5050C] rounded-full px-4 py-2 shadow-lg shadow-[#C5050C]/20">
          <p className="text-xs font-bold text-[#C5050C] tracking-wide">API TEST</p>
        </div>
      </div>
    </main>
  )
}

