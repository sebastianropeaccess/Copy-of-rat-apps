import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OPENAI_KEY = process.env.OPENAI_API_KEY
const SERVICE_ACCOUNT_EMAIL = 'davinci@rat-platform-492313.iam.gserviceaccount.com'
const PRIVATE_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const SDS_FOLDER_ID = '1O9wb9HuJY1ihEU3IqsFekBD4ANooyriw'

async function getDriveToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: SERVICE_ACCOUNT_EMAIL,
    sub: 'leonardo@ropeaccess.com.au',
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))

  const encoder = new TextEncoder()
  const pemContent = PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signatureInput = encoder.encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signatureInput)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${header}.${payload}.${sig}`
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  return (await tokenResp.json()).access_token
}

async function uploadToDrive(pdfData: ArrayBuffer, fileName: string, accessToken: string): Promise<string | null> {
  try {
    const metadata = JSON.stringify({ name: fileName, parents: [SDS_FOLDER_ID] })
    const boundary = 'boundary_' + Date.now()
    const body = new Uint8Array([
      ...new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
      ...new Uint8Array(pdfData),
      ...new TextEncoder().encode(`\r\n--${boundary}--`),
    ])

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    const result = await resp.json()
    return result.id || null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    if (!query || !OPENAI_KEY) {
      return NextResponse.json({ error: 'Missing query or API key' }, { status: 400 })
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SDS (Safety Data Sheet) lookup assistant for the Australian construction industry.
Given a product name, return the key SDS information in JSON format.
Return ONLY valid JSON with these fields:
{
  "productName": "Full product name",
  "manufacturer": "Company name",
  "manufacturerContact": "Phone number and address",
  "hazardClassification": "GHS hazard classification (e.g. FLAMMABLE LIQUIDS - Category 2)",
  "signalWord": "Danger or Warning or none",
  "comments": "Key hazard statements and precautionary info",
  "sdsUrl": "Direct URL to the SDS PDF on the manufacturer's website. Must be a real, working URL ending in .pdf. If you don't know the exact URL, return empty string.",
  "tdsUrl": "Direct URL to the TDS PDF if available, otherwise empty string."
}
If you don't know the product, return {"error": "Product not found"}.
Be accurate. Australian products preferred. Only include URLs you're confident are real.`
          },
          { role: 'user', content: `Find SDS information for: ${query}` }
        ],
        temperature: 0.1,
        max_tokens: 600,
      }),
    })

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    let product
    try {
      product = JSON.parse(cleaned)
      if (product.error) {
        return NextResponse.json({ error: product.error }, { status: 404 })
      }
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Try to download SDS PDF and upload to Drive
    let sdsUploaded = false
    let tdsUploaded = false

    if (PRIVATE_KEY && (product.sdsUrl || product.tdsUrl)) {
      const accessToken = await getDriveToken()

      // Download and upload SDS
      if (product.sdsUrl) {
        try {
          const pdfResp = await fetch(product.sdsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow',
          })
          if (pdfResp.ok) {
            const pdfData = await pdfResp.arrayBuffer()
            // Check if it's actually a PDF
            const header = new Uint8Array(pdfData.slice(0, 4))
            if (header[0] === 0x25 && header[1] === 0x50) { // %P
              const safeName = `${product.manufacturer || 'Unknown'} - ${product.productName || query} - SDS.pdf`.replace(/[/\\:*?"<>|]/g, '-')
              const fileId = await uploadToDrive(pdfData, safeName, accessToken)
              if (fileId) {
                sdsUploaded = true
                product.sdsUploadedToDrive = true
                product.sdsDriveUrl = `https://drive.google.com/file/d/${fileId}/view`
              }
            }
          }
        } catch (e) {
          console.error('[SDS] Failed to download SDS PDF:', e)
        }
      }

      // Download and upload TDS
      if (product.tdsUrl) {
        try {
          const pdfResp = await fetch(product.tdsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow',
          })
          if (pdfResp.ok) {
            const pdfData = await pdfResp.arrayBuffer()
            const header = new Uint8Array(pdfData.slice(0, 4))
            if (header[0] === 0x25 && header[1] === 0x50) {
              const safeName = `${product.manufacturer || 'Unknown'} - ${product.productName || query} - TDS.pdf`.replace(/[/\\:*?"<>|]/g, '-')
              const fileId = await uploadToDrive(pdfData, safeName, accessToken)
              if (fileId) {
                tdsUploaded = true
                product.tdsUploadedToDrive = true
                product.tdsDriveUrl = `https://drive.google.com/file/d/${fileId}/view`
              }
            }
          }
        } catch (e) {
          console.error('[SDS] Failed to download TDS PDF:', e)
        }
      }
    }

    return NextResponse.json({ 
      product, 
      sdsUploaded, 
      tdsUploaded,
      message: sdsUploaded || tdsUploaded 
        ? `Found product info${sdsUploaded ? ' + downloaded SDS' : ''}${tdsUploaded ? ' + downloaded TDS' : ''} to Drive` 
        : 'Found product info (PDF download not available)'
    })
  } catch (error) {
    console.error('[SDS Search] Error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
