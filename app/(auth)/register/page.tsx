'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { signUp } from '@/services/authService'
import { seedDefaultCategories } from '@/services/categoriesService'
import { validateEmail, validatePassword } from '@/lib/validations'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('Informe seu nome.'); return }
    if (!validateEmail(email)) { setError('E-mail inválido.'); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }

    setLoading(true)
    try {
      const data = await signUp(email, password, name)
      if (!data.session) {
        setConfirmed(true)
        return
      }
      await seedDefaultCategories()
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <Card className="p-7 text-center">
        <div className="text-3xl mb-4">📬</div>
        <h2 className="text-base font-800 text-white mb-2">Confirme seu e-mail</h2>
        <p className="text-sm text-white/40 mb-1">Enviamos um link de confirmação para</p>
        <p className="text-sm text-white font-600 mb-5">{email}</p>
        <p className="text-sm text-white/40 mb-6">
          Abra a mensagem e confirme sua conta antes de entrar no RIOW Finance.
        </p>
        <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">← Voltar para o login</Link>
      </Card>
    )
  }

  return (
    <Card className="p-7">
      <h1 className="text-xl font-800 text-white mb-1">Criar conta</h1>
      <p className="text-sm text-white/40 mb-7">Configure seu dashboard financeiro</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
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
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <p className="text-xs text-red-400 bg-red-500/[.08] border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">
          Criar conta
        </Button>
      </form>

      <p className="text-center text-xs text-white/35 mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-white/70 hover:text-white font-700 transition-colors">
          Entrar
        </Link>
      </p>
    </Card>
  )
}
