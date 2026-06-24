import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

type ExternalRole = 'view_only' | 'allocate' | 'full'
type ExternalViewLevel = 'summary' | 'detailed'

interface ExternalUserRecord {
  id: number | string
  email: string
  name: string
  company: string
  role: ExternalRole
  view_level: ExternalViewLevel
  building_ids: number[] | null
  can_allocate: boolean | null
  can_download_reports: boolean | null
  created_at: string
}

interface ExternalUserPayload {
  id?: number | string
  name?: string
  email?: string
  company?: string
  role?: ExternalRole
  view_level?: ExternalViewLevel
  building_ids?: number[]
  can_download_reports?: boolean
  password?: string
  authorised?: boolean
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getAdminClient() {
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function cleanEmail(email: string) {
  return email.trim().toLowerCase()
}

function validatePayload(payload: ExternalUserPayload, creating: boolean) {
  const name = payload.name?.trim()
  const email = payload.email ? cleanEmail(payload.email) : ''
  const company = payload.company?.trim()
  const role = payload.role || 'view_only'
  const viewLevel = payload.view_level || 'summary'
  const buildingIds = Array.isArray(payload.building_ids) ? payload.building_ids.map(Number).filter(Number.isFinite) : []

  if (!name || !email || !company) {
    return { error: 'Name, email, and company are required.' }
  }
  if (!['view_only', 'allocate', 'full'].includes(role)) {
    return { error: 'Invalid external user role.' }
  }
  if (!['summary', 'detailed'].includes(viewLevel)) {
    return { error: 'Invalid view level.' }
  }
  if (creating && (!payload.password || payload.password.length < 8)) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (payload.password && payload.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  return {
    value: {
      name,
      email,
      company,
      role,
      view_level: viewLevel,
      building_ids: buildingIds,
      can_allocate: role === 'allocate' || role === 'full',
      can_download_reports: payload.can_download_reports === true,
      authorised: payload.authorised !== false,
      password: payload.password,
    },
  }
}

type AuthUserLite = {
  id: string
  email?: string
  user_metadata?: Record<string, unknown> | null
  banned_until?: string | null
  last_sign_in_at?: string | null
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string): Promise<AuthUserLite | null> {
  let page = 1
  const perPage = 200

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = (data?.users ?? []) as AuthUserLite[]
    const found = users.find((user) => user.email?.toLowerCase() === email)
    if (found) return found
    if (users.length < perPage) return null
    page += 1
  }

  return null
}

async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string | undefined,
  authorised: boolean,
  existingEmail?: string
) {
  const authUser = await findAuthUserByEmail(supabase, existingEmail || email)

  if (!authUser) {
    if (!password) return null
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { external_access: true },
    })
    if (error) throw error
    const createdUser = (data?.user ?? null) as AuthUserLite | null
    if (!authorised && createdUser) {
      await supabase.auth.admin.updateUserById(createdUser.id, { ban_duration: '876000h' })
    }
    return createdUser
  }

  const updates: Record<string, unknown> = {
    user_metadata: { ...(authUser.user_metadata || {}), external_access: true },
    ban_duration: authorised ? 'none' : '876000h',
    email_confirm: true,
  }
  if (authUser.email?.toLowerCase() !== email) updates.email = email
  if (password) updates.password = password

  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, updates)
  if (error) throw error
  return (data?.user ?? null) as AuthUserLite | null
}

function withAuthStatus(records: ExternalUserRecord[], authUsers: { id: string; email?: string; banned_until?: string | null; last_sign_in_at?: string | null }[]) {
  return records.map((record) => {
    const authUser = authUsers.find((user) => user.email?.toLowerCase() === record.email.toLowerCase())
    const blocked = Boolean(authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now())
    return {
      ...record,
      building_ids: record.building_ids || [],
      can_allocate: record.can_allocate === true,
      can_download_reports: record.can_download_reports === true,
      auth_user_id: authUser?.id || null,
      authorised: Boolean(authUser && !blocked),
      auth_status: authUser ? (blocked ? 'blocked' : 'authorised') : 'missing_auth',
      banned_until: authUser?.banned_until || null,
      last_sign_in_at: authUser?.last_sign_in_at || null,
    }
  })
}

export async function GET() {
  try {
    const supabase = getAdminClient()
    const [{ data: records, error }, { data: authData, error: authError }] = await Promise.all([
      supabase.from('external_users').select('*').order('name'),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    if (error) throw error
    if (authError) throw authError

    return NextResponse.json({ users: withAuthStatus((records || []) as ExternalUserRecord[], authData.users) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load external users.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ExternalUserPayload
    const validation = validatePayload(payload, true)
    if ('error' in validation) return NextResponse.json({ error: validation.error }, { status: 400 })

    const supabase = getAdminClient()
    const value = validation.value
    const authUser = await ensureAuthUser(supabase, value.email, value.password, value.authorised)

    const { data, error } = await supabase
      .from('external_users')
      .insert({
        email: value.email,
        name: value.name,
        company: value.company,
        role: value.role,
        view_level: value.view_level,
        building_ids: value.building_ids,
        can_allocate: value.can_allocate,
        can_download_reports: value.can_download_reports,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ user: withAuthStatus([data as ExternalUserRecord], authUser ? [authUser] : [])[0] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create external user.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as ExternalUserPayload
    if (!payload.id) return NextResponse.json({ error: 'External user ID is required.' }, { status: 400 })

    const validation = validatePayload(payload, false)
    if ('error' in validation) return NextResponse.json({ error: validation.error }, { status: 400 })

    const supabase = getAdminClient()
    const { data: existing, error: existingError } = await supabase
      .from('external_users')
      .select('*')
      .eq('id', payload.id)
      .single()
    if (existingError) throw existingError

    const value = validation.value
    const authUser = await ensureAuthUser(supabase, value.email, value.password, value.authorised, (existing as ExternalUserRecord).email)

    const { data, error } = await supabase
      .from('external_users')
      .update({
        email: value.email,
        name: value.name,
        company: value.company,
        role: value.role,
        view_level: value.view_level,
        building_ids: value.building_ids,
        can_allocate: value.can_allocate,
        can_download_reports: value.can_download_reports,
      })
      .eq('id', payload.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ user: withAuthStatus([data as ExternalUserRecord], authUser ? [authUser] : [])[0] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update external user.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, email } = (await request.json()) as { id?: number | string; email?: string }
    if (!id) return NextResponse.json({ error: 'External user ID is required.' }, { status: 400 })

    const supabase = getAdminClient()
    if (email) {
      const authUser = await findAuthUserByEmail(supabase, cleanEmail(email))
      if (authUser) {
        const { error: authError } = await supabase.auth.admin.deleteUser(authUser.id)
        if (authError) throw authError
      }
    }

    const { error } = await supabase.from('external_users').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete external user.' }, { status: 500 })
  }
}
