const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? ""

export function validateTwilioRequest(req: Request) {
  // For hackathon, you can skip strict validation and trust Vercel route.
  // In production, compute Twilio signature and verify.
  return true
}
