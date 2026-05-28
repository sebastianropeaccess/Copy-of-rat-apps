import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SERVICE_ACCOUNT_EMAIL = 'davinci@rat-platform-492313.iam.gserviceaccount.com'
const PRIVATE_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const SDS_FOLDER_ID = '1O9wb9HuJY1ihEU3IqsFekBD4ANooyriw'
const SCOPES = ['https://www.googleapis.com/auth/drive']

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: SERVICE_ACCOUNT_EMAIL,
    sub: 'chay@ropeaccess.com.au',
    scope: SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const encoder = new TextEncoder()
  const pemContent = PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signatureInput = encoder.encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signatureInput)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${header}.${payload}.${sig}`
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResp.json()
  return tokenData.access_token
}

export async function GET(request: NextRequest) {
  try {
    if (!PRIVATE_KEY) {
      return NextResponse.json({ error: 'Not configured' }, { status: 500 })
    }

    const accessToken = await getAccessToken()

    // List all files in the SDS & TDS folder
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${SDS_FOLDER_ID}' in parents and trashed=false&fields=files(id,name,mimeType,size,webViewLink,webContentLink,createdTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    const data = await resp.json()
    const files = (data.files || []).map((f: Record<string, string>) => {
      // Parse product info from filename
      const name = f.name.replace('.pdf', '').replace('.PDF', '')
      const isSDS = name.toLowerCase().includes('sds') || name.toLowerCase().includes('safety data')
      const isTDS = name.toLowerCase().includes('tds') || name.toLowerCase().includes('technical data')
      
      // Extract manufacturer from naming convention "Manufacturer-Product-SDS/TDS"
      const parts = name.split('-').map((p: string) => p.trim())
      const manufacturer = parts[0] || ''
      const productName = parts.length > 2 ? parts.slice(0, -1).join(' - ') : name

      return {
        id: f.id,
        fileName: f.name,
        productName,
        manufacturer,
        type: isTDS ? 'TDS' : isSDS ? 'SDS' : 'Unknown',
        size: f.size,
        viewUrl: f.webViewLink,
        downloadUrl: f.webContentLink,
        driveUrl: `https://drive.google.com/file/d/${f.id}/view`,
        createdTime: f.createdTime,
      }
    })

    return NextResponse.json({ files, total: files.length })
  } catch (error) {
    console.error('[SDS Drive] Error:', error)
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
  }
}
