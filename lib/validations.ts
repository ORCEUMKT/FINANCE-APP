export interface FieldError {
  field: string
  message: string
}

export function validateTransaction(data: {
  description?: string
  value?: string | number
  date?: string
  category_id?: string | null
}): FieldError[] {
  const errors: FieldError[] = []

  if (!data.description?.trim()) {
    errors.push({ field: 'description', message: 'Descrição é obrigatória.' })
  } else if (data.description.trim().length > 120) {
    errors.push({ field: 'description', message: 'Máximo 120 caracteres.' })
  }

  const val = Number(data.value)
  if (!data.value || isNaN(val) || val <= 0) {
    errors.push({ field: 'value', message: 'Informe um valor válido.' })
  }

  if (!data.date) {
    errors.push({ field: 'date', message: 'Data é obrigatória.' })
  }

  return errors
}

export function validateCategory(data: {
  name?: string
  color?: string
}): FieldError[] {
  const errors: FieldError[] = []
  if (!data.name?.trim()) errors.push({ field: 'name', message: 'Nome é obrigatório.' })
  if (data.color && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
    errors.push({ field: 'color', message: 'Cor inválida.' })
  }
  return errors
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Mínimo 6 caracteres.'
  return null
}
