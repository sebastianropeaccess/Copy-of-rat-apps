import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

let _supabase: SupabaseClient | null = null
function getBrokenGearClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')
        ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

type ReportPayload = {
  gear_item_id?: string | null
  gear_id?: string | null
  gear_make?: string
  gear_model?: string | null
  gear_category?: string | null
  issue_description?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  remove_from_service?: boolean
  replacement_required?: boolean
  replacement_urgency?: 'same_day' | 'next_day' | 'this_week' | 'not_urgent' | null
  replacement_needed_by?: string | null
  job_id?: string | null
  job_number?: string | null
  job_name?: string | null
  site_name?: string | null
  reported_by?: string
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableText(value: FormDataEntryValue | null) {
  const cleaned = cleanText(value)
  return cleaned || null
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true' || value === 'on' || value === '1'
}

function getRecipients() {
  return (process.env.BROKEN_GEAR_NOTIFY_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

function formatUrgency(value: string | null | undefined) {
  if (!value) return 'Not set'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function mediaType(file: File) {
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type.startsWith('video/')) return 'video'
  return 'file'
}

async function sendNotification(report: Required<Pick<ReportPayload, 'gear_make' | 'issue_description' | 'reported_by'>> & ReportPayload, mediaUrls: string[]) {
  const recipients = getRecipients()
  if (recipients.length === 0) {
    return { sent: false, error: 'BROKEN_GEAR_NOTIFY_EMAILS is not configured.' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY is not configured.' }
  }

  const subjectPrefix = report.severity === 'critical' || report.replacement_required ? 'Action required' : 'New report'
  const subject = `${subjectPrefix}: broken gear - ${report.gear_make}${report.gear_model ? ` ${report.gear_model}` : ''}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f1a2e">
      <h2 style="margin:0 0 12px">Broken gear report</h2>
      <p><strong>Reported by:</strong> ${report.reported_by}</p>
      <p><strong>Gear:</strong> ${report.gear_make}${report.gear_model ? ` ${report.gear_model}` : ''}${report.gear_id ? ` (${report.gear_id})` : ''}</p>
      <p><strong>Category:</strong> ${report.gear_category || 'Not set'}</p>
      <p><strong>Severity:</strong> ${report.severity || 'medium'}</p>
      <p><strong>Remove from service:</strong> ${report.remove_from_service ? 'Yes' : 'No'}</p>
      <p><strong>Replacement required:</strong> ${report.replacement_required ? 'Yes' : 'No'}</p>
      <p><strong>Replacement urgency:</strong> ${formatUrgency(report.replacement_urgency)}</p>
      <p><strong>Job:</strong> ${report.job_number || report.job_name || 'Not linked'}</p>
      <p><strong>Issue:</strong><br>${report.issue_description.replace(/\n/g, '<br>')}</p>
      ${mediaUrls.length ? `<p><strong>Media:</strong><br>${mediaUrls.map((url) => `<a href="${url}">${url}</a>`).join('<br>')}</p>` : ''}
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.BROKEN_GEAR_EMAIL_FROM || 'RAT Apps <notifications@ropeaccess.com.au>',
      to: recipients,
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    return { sent: false, error: `Email send failed: ${text.slice(0, 240)}` }
  }

  return { sent: true, error: null }
}

export async function POST(request: NextRequest) {
  const supabase = getBrokenGearClient()
  try {
    const formData = await request.formData()
    const gearMake = cleanText(formData.get('gear_make'))
    const issueDescription = cleanText(formData.get('issue_description'))
    const reportedBy = cleanText(formData.get('reported_by'))

    if (!gearMake || !issueDescription || !reportedBy) {
      return NextResponse.json({ error: 'Gear make, issue, and reported by are required.' }, { status: 400 })
    }

    const report: ReportPayload = {
      gear_item_id: nullableText(formData.get('gear_item_id')),
      gear_id: nullableText(formData.get('gear_id')),
      gear_make: gearMake,
      gear_model: nullableText(formData.get('gear_model')),
      gear_category: nullableText(formData.get('gear_category')),
      issue_description: issueDescription,
      severity: (cleanText(formData.get('severity')) || 'medium') as ReportPayload['severity'],
      remove_from_service: parseBoolean(formData.get('remove_from_service')),
      replacement_required: parseBoolean(formData.get('replacement_required')),
      replacement_urgency: nullableText(formData.get('replacement_urgency')) as ReportPayload['replacement_urgency'],
      replacement_needed_by: nullableText(formData.get('replacement_needed_by')),
      job_id: nullableText(formData.get('job_id')),
      job_number: nullableText(formData.get('job_number')),
      job_name: nullableText(formData.get('job_name')),
      site_name: nullableText(formData.get('site_name')),
      reported_by: reportedBy,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('broken_gear_reports')
      .insert(report)
      .select('*')
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message || 'Report insert failed.' }, { status: 500 })
    }

    const files = formData.getAll('media').filter((value): value is File => value instanceof File && value.size > 0)
    const mediaRows: Array<{ report_id: string; media_type: string; url: string; file_name: string }> = []

    for (const file of files) {
      const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg')
      const safeName = file.name.replace(/[^\w.\-]+/g, '-').slice(0, 80) || `media.${ext}`
      const path = `${inserted.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('broken-gear-media')
        .upload(path, file, { contentType: file.type || undefined, upsert: false })

      if (uploadError) {
        await supabase
          .from('broken_gear_reports')
          .update({ notification_error: `Media upload failed: ${uploadError.message}` })
          .eq('id', inserted.id)
        return NextResponse.json({ error: `Media upload failed: ${uploadError.message}` }, { status: 500 })
      }

      const { data: urlData } = supabase.storage.from('broken-gear-media').getPublicUrl(path)
      mediaRows.push({
        report_id: inserted.id,
        media_type: mediaType(file),
        url: urlData.publicUrl,
        file_name: file.name,
      })
    }

    if (mediaRows.length > 0) {
      const { error: mediaError } = await supabase.from('broken_gear_media').insert(mediaRows)
      if (mediaError) {
        return NextResponse.json({ error: `Media save failed: ${mediaError.message}` }, { status: 500 })
      }
    }

    const notification = await sendNotification(
      {
        ...report,
        gear_make: report.gear_make!,
        issue_description: report.issue_description!,
        reported_by: report.reported_by!,
      },
      mediaRows.map((row) => row.url)
    )

    await supabase
      .from('broken_gear_reports')
      .update({
        notification_sent: notification.sent,
        notification_error: notification.error,
      })
      .eq('id', inserted.id)

    return NextResponse.json({
      success: true,
      reportId: inserted.id,
      notification,
    })
  } catch (error) {
    console.error('[Broken Gear] POST error:', error)
    return NextResponse.json({ error: 'Broken gear report failed.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = getBrokenGearClient()
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Report id is required.' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (body.status) updates.status = body.status
    if (typeof body.resolution_notes === 'string') updates.resolution_notes = body.resolution_notes.trim() || null
    if (body.reviewed_by) {
      updates.reviewed_by = body.reviewed_by
      updates.reviewed_at = new Date().toISOString()
    }

    const { error } = await supabase.from('broken_gear_reports').update(updates).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Broken Gear] PATCH error:', error)
    return NextResponse.json({ error: 'Broken gear update failed.' }, { status: 500 })
  }
}
