export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function formatDateInput(date: string): string {
  // "2026-06-08" → "08/06/2026"
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

export function toISODate(dateStr: string): string {
  // Accepts "DD/MM/YYYY" or "DD/MM" (assumes current year)
  const parts = dateStr.split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  const year = new Date().getFullYear()
  return `${year}-${parts[1]}-${parts[0]}`
}

export function formatRelativeDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === -1) return 'Ontem'
  if (diff === 1) return 'Amanhã'
  return formatDate(date)
}
