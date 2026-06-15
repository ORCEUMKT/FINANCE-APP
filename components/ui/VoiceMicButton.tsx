'use client'

import { useState, useRef } from 'react'
import { Mic, Square } from 'lucide-react'

interface VoiceMicButtonProps {
  onResult: (transcript: string) => void
  onError?: (message: string) => void
  className?: string
}

export function VoiceMicButton({ onResult, onError, className }: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)

  function start() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      onError?.('Reconhecimento de voz não suportado. Use Chrome ou Safari.')
      return
    }

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = true      // keep listening across natural pauses
    rec.interimResults = false // only fire on final results
    rec.maxAlternatives = 1

    const segments: string[] = []
    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    rec.onstart = () => setListening(true)

    rec.onresult = (e: { resultIndex: number; results: { length: number; [k: number]: { isFinal: boolean; [k: number]: { transcript: string } } } }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) segments.push(e.results[i][0].transcript)
      }
      // Reset silence timer — waits 2.5s after last speech segment before auto-stopping
      if (silenceTimer) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => rec.stop(), 2500)
    }

    rec.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer)
      setListening(false)
      recRef.current = null
      const full = segments.join(' ').trim()
      if (full) onResult(full)
    }

    rec.onerror = (e: { error: string }) => {
      if (silenceTimer) clearTimeout(silenceTimer)
      setListening(false)
      recRef.current = null
      if (e.error === 'not-allowed')
        onError?.('Permissão de microfone negada. Habilite nas configurações do browser.')
      else if (e.error !== 'no-speech')
        onError?.(`Erro no microfone: ${e.error}`)
    }

    recRef.current = rec
    rec.start()
  }

  function stop() {
    recRef.current?.stop()
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? 'Parar gravação' : 'Lançamento por voz (PT-BR)'}
      className={`relative flex items-center justify-center flex-shrink-0 transition-all duration-200 ${className ?? 'w-11 h-11 rounded-[14px]'}`}
      style={{
        background: listening ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${listening ? 'rgba(248,113,113,0.4)' : 'var(--border)'}`,
        color: listening ? '#f87171' : 'var(--text-2)',
        boxShadow: listening ? '0 0 16px rgba(248,113,113,0.15)' : 'none',
      }}
    >
      {listening && (
        <span
          className="absolute inset-0 animate-ping rounded-[14px] opacity-30"
          style={{ background: '#f87171' }}
        />
      )}
      {listening ? <Square size={13} fill="currentColor" /> : <Mic size={16} />}
    </button>
  )
}
