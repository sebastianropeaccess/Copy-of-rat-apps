import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Google Service Account credentials
const SERVICE_ACCOUNT = {
  client_email: 'davinci@rat-platform-492313.iam.gserviceaccount.com',
  private_key: process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  token_uri: 'https://oauth2.googleapis.com/token',
}

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID || ''
const SCOPES = ['https://www.googleapis.com/auth/drive.file']

function safeDriveName(value: string) {
  return (value || 'Unknown').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'Unknown'
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: SERVICE_ACCOUNT.client_email,
    sub: 'leonardo@ropeaccess.com.au',
    scope: SCOPES.join(' '),
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
  }))

  // Sign JWT with private key
  const encoder = new TextEncoder()
  const keyData = SERVICE_ACCOUNT.private_key
  const pemContent = keyData.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureInput = encoder.encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signatureInput)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${header}.${payload}.${sig}`

  const tokenResp = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResp.json()
  return tokenData.access_token
}

export async function POST(request: NextRequest) {
  try {
    if (!SERVICE_ACCOUNT.private_key || !DRIVE_FOLDER_ID) {
      return NextResponse.json({ error: 'Google Drive not configured' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const module = formData.get('module') as string || 'repair'
    const buildingName = formData.get('buildingName') as string || 'Unknown'
    const repairNumber = formData.get('repairNumber') as string || 'Unknown'
    const dropLabel = formData.get('dropLabel') as string || ''
    const propertyAddress = formData.get('propertyAddress') as string || buildingName
    const inspectionDate = formData.get('inspectionDate') as string || new Date().toISOString().slice(0, 10)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const accessToken = await getAccessToken()

    // Create folder structure: Simple Repair App / Building Name / Drop X / photo.jpg
    async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
      const folderName = safeDriveName(name)
      const searchResp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${escapeDriveQuery(folderName)}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const searchData = await searchResp.json()
      
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id
      }
      
      const createResp = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      })
      const createData = await createResp.json()
      return createData.id
    }

    let targetFolderId: string
    if (module === 'site_visit') {
      const siteVisitsFolderId = await getOrCreateFolder('Site Visits', DRIVE_FOLDER_ID)
      const propertyFolderId = await getOrCreateFolder(propertyAddress, siteVisitsFolderId)
      targetFolderId = await getOrCreateFolder(inspectionDate, propertyFolderId)
    } else {
      // Create folder structure: Simple Repair App / Building Name / Drop X / photo.jpg
      const buildingFolderId = await getOrCreateFolder(buildingName, DRIVE_FOLDER_ID)
      targetFolderId = dropLabel
        ? await getOrCreateFolder(`Drop ${dropLabel}`, buildingFolderId)
        : buildingFolderId
    }

    // Upload file
    const fallbackExt = file.type === 'application/pdf' ? 'pdf' : 'jpg'
    const fileName = module === 'site_visit'
      ? safeDriveName(file.name || `site-visit-report-${Date.now()}.${fallbackExt}`)
      : `${safeDriveName(repairNumber)}_${Date.now()}.jpg`
    const fileBuffer = await file.arrayBuffer()

    const metadata = JSON.stringify({
      name: fileName,
      parents: [targetFolderId],
    })

    const boundary = 'boundary_' + Date.now()
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
    ]

    const bodyParts = new Uint8Array([
      ...new TextEncoder().encode(body[0]),
      ...new TextEncoder().encode(body[1]),
      ...new Uint8Array(fileBuffer),
      ...new TextEncoder().encode(`\r\n--${boundary}--`),
    ])

    const uploadResp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&includeItemsFromAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyParts,
      }
    )

    const uploadData = await uploadResp.json()
    
    return NextResponse.json({ 
      success: true, 
      fileId: uploadData.id,
      fileName: uploadData.name,
      webViewLink: uploadData.id ? `https://drive.google.com/file/d/${uploadData.id}/view` : null,
    })
  } catch (error) {
    console.error('[Drive Upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
