import type { RatUser, ExternalUser, Asset } from './types'

// === Asset allocation queue (persisted so a half-built list survives an app close) ===
const ALLOCATION_QUEUE_KEY = 'asset_allocation_queue'

export function getAllocationQueue(): Asset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ALLOCATION_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Asset[]) : []
  } catch {
    return []
  }
}

export function setAllocationQueue(assets: Asset[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ALLOCATION_QUEUE_KEY, JSON.stringify(assets))
}

export function clearAllocationQueue(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ALLOCATION_QUEUE_KEY)
}

export function getDropLabel(index: number, labelling: 'alpha' | 'numeric'): string {
  if (labelling === 'numeric') return String(index + 1)
  let label = ''
  let n = index
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

export function displayName(completedBy: string): string {
  if (!completedBy) return ''
  if (completedBy.includes('@')) {
    return completedBy
      .split('@')[0]
      .split(/[.\-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
  }
  return completedBy
}

export function getStoredUser(): RatUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('rat_user')
    if (!raw) return null
    return JSON.parse(raw) as RatUser
  } catch {
    return null
  }
}

export function setStoredUser(user: RatUser): void {
  localStorage.setItem('rat_user', JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem('rat_user')
}

export function getStoredExternalUser(): ExternalUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('rat_external_user')
    if (!raw) return null
    return JSON.parse(raw) as ExternalUser
  } catch {
    return null
  }
}

export function setStoredExternalUser(user: ExternalUser): void {
  localStorage.setItem('rat_external_user', JSON.stringify(user))
}

export function clearStoredExternalUser(): void {
  localStorage.removeItem('rat_external_user')
}

export function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') ||
    lower.includes('.mp4?') || lower.includes('.mov?') || lower.includes('.webm?')
}
