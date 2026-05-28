'use client'

import { useState, useEffect, useCallback } from 'react'
import { getQueueCount, processQueue, initAutoSync } from './offline'

export default function SyncIndicator() {
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(true)

  const refreshCount = useCallback(async () => {
    try {
      const c = await getQueueCount()
      setCount(c)
    } catch {
      // IndexedDB not available
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    setOnline(navigator.onLine)
    refreshCount()

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Poll queue count every 3 seconds
    const interval = setInterval(refreshCount, 3000)

    initAutoSync(() => refreshCount())

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [refreshCount])

  async function handleTap() {
    if (syncing || count === 0) return
    setSyncing(true)
    try {
      await processQueue()
      await refreshCount()
    } finally {
      setSyncing(false)
    }
  }

  // Hide when nothing to show
  if (count === 0 && online) return null

  const dotColor = !online
    ? 'bg-red-500'
    : count > 0
      ? 'bg-orange'
      : 'bg-green-500'

  return (
    <button
      onClick={handleTap}
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-navy/90 backdrop-blur-sm shadow-lg active:scale-95 transition-all"
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} ${syncing ? 'animate-pulse' : ''}`} />
      <span className="text-xs font-medium text-white">
        {!online
          ? 'Offline'
          : syncing
            ? 'Syncing...'
            : count > 0
              ? `${count} pending`
              : 'Synced'}
      </span>
    </button>
  )
}
