export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  type: 'expense' | 'income' | 'both'
  is_default: boolean
  created_at: string
}

export type CategoryInsert = {
  name: string
  icon?: string
  color?: string
  type?: Category['type']
}

export type CategoryUpdate = Partial<CategoryInsert>

export const DEFAULT_CATEGORIES: Omit<CategoryInsert, never>[] = [
  { name: 'Chácara / Manutenção',   icon: 'tree',         color: '#4ECCA3', type: 'expense' },
  { name: 'Alimentação / Lazer',    icon: 'utensils',     color: '#F7B731', type: 'expense' },
  { name: 'Funcionários Domésticos',icon: 'users',        color: '#A29BFE', type: 'expense' },
  { name: 'Lazer / Motocross',      icon: 'bike',         color: '#FD79A8', type: 'expense' },
  { name: 'Igreja / Religião',      icon: 'church',       color: '#74B9FF', type: 'expense' },
  { name: 'Contabilidade',          icon: 'file-text',    color: '#55EFC4', type: 'expense' },
  { name: 'Veículo',                icon: 'car',          color: '#FDCB6E', type: 'expense' },
  { name: 'Casa / Serviços',        icon: 'home',         color: '#E17055', type: 'expense' },
  { name: 'Pessoal / Beleza',       icon: 'scissors',     color: '#FFA8C5', type: 'expense' },
  { name: 'Documentação',           icon: 'file',         color: '#81ECEC', type: 'expense' },
  { name: 'Presentes / Família',    icon: 'gift',         color: '#FFD32A', type: 'expense' },
  { name: 'Mercado',                icon: 'shopping-bag', color: '#C7A0FF', type: 'expense' },
  { name: 'Receita / Entrada',      icon: 'arrow-down-circle', color: '#89F2C2', type: 'income' },
  { name: 'A Recuperar',            icon: 'rotate-ccw',   color: '#FF7584', type: 'both'    },
]
