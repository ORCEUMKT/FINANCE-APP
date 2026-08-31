'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/services/authService'

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession]         = useState(false)
  const [password, setPassword]             = useState('')
  const [confirm, setConfirm]               = useState('')
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [done, setDone]                     = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
      setSessionChecked(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setDone(true)
      try { await signOut() } catch { /* sessão já pode ter sido invalidada após o update */ }
      router.push('/login')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar senha.')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionChecked) {
    return (
      <Card className="p-7">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-40 rounded-lg bg-white/[.06] animate-pulse" />
          <div className="h-3 w-56 rounded-lg bg-white/[.04] animate-pulse" />
        </div>
      </Card>
    )
  }

  if (!hasSession) {
    return (
      <Card className="p-7 text-center">
        <div className="text-3xl mb-4">🔒</div>
        <h2 className="text-base font-800 text-white mb-2">Link inválido ou expirado</h2>
        <p className="text-sm text-white/40 mb-6 leading-relaxed">
          Este link de redefinição não é mais válido. Solicite um novo e-mail de recuperação.
        </p>
        <Link href="/forgot-password" className="text-sm text-white/60 hover:text-white transition-colors">
          Solicitar novo link →
        </Link>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="p-7 text-center">
        <div className="text-3xl mb-4">✅</div>
        <h2 className="text-base font-800 text-white mb-2">Senha atualizada!</h2>
        <p className="text-sm text-white/40">Redirecionando para o login...</p>
      </Card>
    )
  }

  return (
    <Card className="p-7">
      <h1 className="text-xl font-800 text-white mb-1">Nova senha</h1>
      <p className="text-sm text-white/40 mb-7">Defina uma nova senha para sua conta</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nova senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && (
          <p className="text-xs text-red-400 bg-red-500/[.08] border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">
          Salvar nova senha
        </Button>
      </form>
    </Card>
  )
}
