import { NextRequest, NextResponse } from 'next/server'

const JGID_API_URL = 'https://ropeaccesstechnicians.myjgid.com/api/v2/workflow/jobs'
const JGID_API_TOKEN =
  process.env.JGID_API_TOKEN ||
  '5scXNGs98tRUI7rdGc4IJ14vHvKO382j7qDqXLRQelhgVuFptNhLmXWko8dY7edD'
const PAGE_SIZE = 100
const CACHE_TTL_MS = 60 * 60 * 1000
const RETRY_DELAY_MS = 2000
const ALLOWED_STATUSES = new Set(['CURRENT', 'PREPARATION', 'PENDING'])

type RawJob = {
  job_no?: string
  title?: string
  status?: string
  location?: {
    site_name?: string
  } | null
  client?: {
    name?: string
  } | null
}

type JsonApiJob = {
  attributes?: RawJob
} & RawJob

type JobSummary = {
  id: string
  job_no: string
  site: string
  title: string
  client: string
  status: string
}

let cache: { timestamp: number; data: JobSummary[] } | null = null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeJob(job: JsonApiJob): RawJob {
  return job.attributes ?? job
}

async function fetchJobsPage(page: number, allowRetry = true): Promise<JsonApiJob[]> {
  const url = new URL(JGID_API_URL)
  url.searchParams.set('page[number]', String(page))
  url.searchParams.set('page[size]', String(PAGE_SIZE))

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${JGID_API_TOKEN}`,
    },
    cache: 'no-store',
  })

  if (response.status === 403 && allowRetry) {
    await sleep(RETRY_DELAY_MS)
    return fetchJobsPage(page, false)
  }

  if (!response.ok) {
    throw new Error(`JGID API request failed for page ${page} with status ${response.status}`)
  }

  const responseText = await response.text()
  const sanitized = responseText.replace(/[\x00-\x1f\x7f]/g, '')
  const parsed = JSON.parse(sanitized) as { data?: JsonApiJob[] }

  return Array.isArray(parsed.data) ? parsed.data : []
}

async function fetchAllJobs(): Promise<JobSummary[]> {
  const jobs: JobSummary[] = []

  for (let page = 1; ; page += 1) {
    const pageJobs = await fetchJobsPage(page)

    if (pageJobs.length === 0) {
      break
    }

    for (const pageJob of pageJobs) {
      const job = normalizeJob(pageJob)

      if (!job.job_no || !job.status || !ALLOWED_STATUSES.has(job.status)) {
        continue
      }

      jobs.push({
        id: job.job_no,
        job_no: job.job_no,
        site: job.location?.site_name || '',
        title: job.title || '',
        client: job.client?.name || '',
        status: job.status,
      })
    }
  }

  jobs.sort((a, b) => a.title.localeCompare(b.title))

  return jobs
}

export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'
    const now = Date.now()

    if (!refresh && cache && now - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cache.data)
    }

    const jobs = await fetchAllJobs()
    cache = { timestamp: now, data: jobs }

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('[JGID Jobs] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 502 })
  }
}
