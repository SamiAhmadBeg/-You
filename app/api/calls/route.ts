import { NextResponse } from "next/server"

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    
    if (!accountSid || !authToken) {
      console.error('Missing Twilio credentials')
      return NextResponse.json({ calls: [], error: 'Missing credentials' })
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?PageSize=50`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Twilio API error:', response.status, errorText)
      return NextResponse.json({ calls: [], error: `Twilio error: ${response.status}` })
    }

    const data = await response.json()
    
    // Return ALL calls, no filtering
    const calls = (data.calls || [])
      .slice(0, 20)
      .map((call: any) => ({
        id: call.sid,
        from: call.from || 'Unknown',
        time: call.start_time || call.date_created,
        modeAtTime: "normal" as const,
        summary: `${call.direction || 'unknown'} - ${call.status} - ${call.duration}s`,
        action: call.status === 'completed' ? 'answered' : call.status,
      }))

    console.log(`Fetched ${calls.length} calls from Twilio`)
    return NextResponse.json({ calls })
  } catch (error) {
    console.error('Error fetching Twilio calls:', error)
    return NextResponse.json({ calls: [], error: String(error) })
  }
}
