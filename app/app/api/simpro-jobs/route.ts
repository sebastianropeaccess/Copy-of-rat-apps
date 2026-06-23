// API route: GET /api/simpro-jobs
// Returns active Simpro jobs for the receipt job picker

import { NextResponse } from 'next/server'

const SIMPRO_URL = 'https://ropeaccess.simprosuite.com'
const SIMPRO_KEY = process.env.SIMPRO_API_KEY || ''

export async function GET() {
  try {
    const res = await fetch(
      `${SIMPRO_URL}/api/v1.0/companies/0/jobs/?pageSize=100&columns=ID,Type,Site,Status,Name,DateIssued`,
      {
        headers: {
          'Authorization': `Bearer ${SIMPRO_KEY}`,
          'Accept': 'application/json',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 502 })
    }

    const jobs = await res.json()

    // Map to a simple format for the picker
    const mapped = jobs.map((j: any) => ({
      id: j.ID,
      site: j.Site?.Name || '',
      name: j.Name || '',
      status: j.Status?.Name || '',
      date: j.DateIssued || '',
    }))

    return NextResponse.json(mapped)
  } catch (err) {
    console.error('Simpro jobs fetch error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
