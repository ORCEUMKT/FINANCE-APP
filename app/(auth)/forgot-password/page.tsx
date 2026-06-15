'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { forgotPassword } from '@/services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar e-mail.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card className="p-7 text-center">
        <div className="text-3xl mb-4">📬</div>
        <h2 className="text-base font-800 text-white mb-2">E-mail enviado!</h2>
        <p className="text-sm text-white/40 mb-6">Verifique sua caixa de entrada para redefinir sua senha.</p>
        <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">← Voltar para o login</Link>
      </Card>
    )
  }

  return (
    <Card className="p-7">
      <h1 className="text-xl font-800 text-white mb-1">Recuperar senha</h1>
      <p className="text-sm text-white/40 mb-7">Enviaremos um link de redefinição</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="text-xs text-red-400 bg-red-500/[.08] border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">
          Enviar link
        </Button>
      </form>

      <p className="text-center text-xs text-white/35 mt-6">
        <Link href="/login" className="text-white/60 hover:text-white transition-colors">← Voltar para o login</Link>
      </p>
    </Card>
  )
}
