'use client'

import { useRef, useEffect, useCallback } from 'react'

interface SignatureCanvasProps {
  onSignatureChange?: (dataUrl: string | null) => void
}

export default function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const hasContentRef = useRef(false)

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const getPos = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return null
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const emitChange = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !onSignatureChange) return
    if (hasContentRef.current) {
      onSignatureChange(canvas.toDataURL('image/png'))
    } else {
      onSignatureChange(null)
    }
  }, [onSignatureChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, rect.width, rect.height)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      isDrawingRef.current = true
      const pos = getPos(e)
      if (!pos) return
      const ctx = getCtx()
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(pos.x / (window.devicePixelRatio || 1), pos.y / (window.devicePixelRatio || 1))
    }

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return
      e.preventDefault()
      const pos = getPos(e)
      if (!pos) return
      const ctx = getCtx()
      if (!ctx) return
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x / (window.devicePixelRatio || 1), pos.y / (window.devicePixelRatio || 1))
      ctx.stroke()
      hasContentRef.current = true
    }

    const handleEnd = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        emitChange()
      }
    }

    canvas.addEventListener('mousedown', handleStart)
    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseup', handleEnd)
    canvas.addEventListener('mouseleave', handleEnd)
    canvas.addEventListener('touchstart', handleStart, { passive: false })
    canvas.addEventListener('touchmove', handleMove, { passive: false })
    canvas.addEventListener('touchend', handleEnd)
    canvas.addEventListener('touchcancel', handleEnd)

    return () => {
      canvas.removeEventListener('mousedown', handleStart)
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseup', handleEnd)
      canvas.removeEventListener('mouseleave', handleEnd)
      canvas.removeEventListener('touchstart', handleStart)
      canvas.removeEventListener('touchmove', handleMove)
      canvas.removeEventListener('touchend', handleEnd)
      canvas.removeEventListener('touchcancel', handleEnd)
    }
  }, [getCtx, getPos, emitChange])

  function handleClear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    hasContentRef.current = false
    emitChange()
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full bg-white border border-gray-300 rounded-lg cursor-crosshair touch-none"
        style={{ minHeight: 150 }}
      />
      <button
        type="button"
        onClick={handleClear}
        className="mt-1 text-xs text-gray-500 underline active:text-gray-700"
      >
        Clear
      </button>
    </div>
  )
}
