/**
 * Offline queue manager using IndexedDB
 * Stores pending repairs, steps, and status changes when offline
 * Auto-syncs when connection is restored
 */

import { getSupabase } from './supabase'

const DB_NAME = 'rat-offline'
const DB_VERSION = 1
const STORE_NAME = 'sync_queue'

export interface QueueItem {
  id: string
  type: 'repair' | 'repair_step' | 'status_change'
  action: 'insert' | 'update'
  table: string
  data: Record<string, unknown>
  photoBlobs: { field: string; blob: Blob; storagePath: string }[]
  createdAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function addToQueue(
  item: Omit<QueueItem, 'id' | 'createdAt'>
): Promise<string> {
  const db = await openDB()
  const id = crypto.randomUUID()
  const queueItem: QueueItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(queueItem)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as QueueItem[])
    request.onerror = () => reject(request.error)
  })
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  const items = await getQueue()
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      const supabase = getSupabase()

      // Upload any photo blobs first
      const photoUrls: Record<string, string> = {}
      for (const photo of item.photoBlobs) {
        const { error: uploadError } = await supabase
          .storage
          .from('repairs')
          .upload(photo.storagePath, photo.blob, { upsert: true })

        if (uploadError) {
          // If file already exists, that's ok — just get the URL
          if (!uploadError.message?.includes('already exists')) {
            throw uploadError
          }
        }

        const { data: urlData } = supabase
          .storage
          .from('repairs')
          .getPublicUrl(photo.storagePath)

        if (urlData?.publicUrl) {
          photoUrls[photo.field] = urlData.publicUrl
        }
      }

      // Merge photo URLs into data
      const finalData = { ...item.data, ...photoUrls }

      if (item.action === 'insert') {
        // Remove client-generated id so Supabase auto-generates integer id
        const { id: _clientId, ...insertData } = finalData
        const { error } = await supabase
          .from(item.table)
          .insert(insertData as Record<string, unknown>)

        if (error) throw error
      } else {
        const id = finalData.id as string
        const { id: _id, ...updateData } = finalData
        const { error } = await supabase
          .from(item.table)
          .update(updateData)
          .eq('id', id)

        if (error) throw error
      }

      await removeFromQueue(item.id)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

// Auto-sync on online event and visibility change
let _initialized = false

export function initAutoSync(onSyncComplete?: () => void) {
  if (typeof window === 'undefined' || _initialized) return
  _initialized = true

  const doSync = async () => {
    const count = await getQueueCount()
    if (count > 0 && navigator.onLine) {
      await processQueue()
      onSyncComplete?.()
    }
  }

  window.addEventListener('online', doSync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') doSync()
  })
  window.addEventListener('focus', doSync)
}

/**
 * Try a Supabase operation, queue it if offline/failed
 */
export async function tryOrQueue(
  operation: () => Promise<{ error: unknown }>,
  queueItem: Omit<QueueItem, 'id' | 'createdAt'>
): Promise<{ online: boolean; error?: unknown }> {
  if (!navigator.onLine) {
    await addToQueue(queueItem)
    return { online: false }
  }

  try {
    const result = await operation()
    if (result.error) {
      await addToQueue(queueItem)
      return { online: false, error: result.error }
    }
    return { online: true }
  } catch (err) {
    await addToQueue(queueItem)
    return { online: false, error: err }
  }
}

export async function clearQueue(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
