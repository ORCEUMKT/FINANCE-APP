'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { signIn } from '@/services/authService'
import { seedDefaultCategories } from '@/services/categoriesService'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      await seedDefaultCategories()
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-7">
      <h1 className="text-xl font-800 text-white mb-1">Entrar</h1>
      <p className="text-sm text-white/40 mb-7">Acesse sua conta financeira</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-xs text-white/40 hover:text-white transition-colors">
            Esqueci minha senha
          </Link>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-500/[.08] border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">
          Entrar
        </Button>
      </form>

      <p className="text-center text-xs text-white/35 mt-6">
        Não tem conta?{' '}
        <Link href="/register" className="text-white/70 hover:text-white font-700 transition-colors">
          Criar conta
        </Link>
      </p>
    </Card>
  )
}
