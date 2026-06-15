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
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onstart  = () => setListening(true)
    rec.onend    = () => setListening(false)

    rec.onerror  = (e: { error: string }) => {
      setListening(false)
      if (e.error === 'not-allowed')
        onError?.('Permissão de microfone negada. Habilite nas configurações do browser.')
      else if (e.error === 'no-speech')
        onError?.('Nenhum áudio detectado. Fale mais perto do microfone.')
      else
        onError?.(`Erro no microfone: ${e.error}`)
    }

    rec.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => {
      const transcript = e.results[0][0].transcript
      onResult(transcript)
    }

    recRef.current = rec
    rec.start()
  }

  function stop() {
    recRef.current?.stop()
    setListening(false)
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
      {/* Pulse ring when recording */}
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
