// API route: POST /api/scan-receipt
// Accepts a base64 receipt image, returns extracted fields via AI vision
// Requires OPENAI_API_KEY in env

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { image } = await req.json() // base64 data URL
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a receipt scanner. Extract data from receipt images and return ONLY valid JSON with these fields:
{
  "store_name": "string or null",
  "date_of_purchase": "YYYY-MM-DD or null",
  "total_inc_gst": "number or null (the final total amount)",
  "card_or_account": "string or null (last 4 digits of card if visible, e.g. 'Visa ****1234')",
  "items": [{"name": "item description", "qty": 1, "price": 12.50}],
  "confidence": "high | medium | low"
}
Return ONLY the JSON object. No markdown, no explanation.
If you can't read a field, set it to null.
For total_inc_gst, extract the final total including GST/tax. Return as a number (no $ sign).
For date, convert to YYYY-MM-DD format regardless of how it appears on the receipt. Assume Australian date format (DD/MM/YYYY) if ambiguous.
For items: extract each line item with name, quantity (default 1 if not shown), and price (the line total). If items are unreadable, return an empty array. Price should be a number (no $ sign).`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the data from this receipt:' },
              { type: 'image_url', image_url: { url: image, detail: 'high' } }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenAI API error:', err)
      return NextResponse.json({ error: 'AI scan failed' }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 502 })
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed
    try {
      const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json({ error: 'Could not parse receipt data' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Scan receipt error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
