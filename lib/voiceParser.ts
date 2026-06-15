// Parses a Portuguese speech transcript into transaction fields.
// Examples:
//   "gastei 150 reais no mercado"   → expense, 150, "Mercado"
//   "paguei 233,50 conta de luz"    → expense, 233.50, "Conta de luz"
//   "recebi 2500 do salário"        → income, 2500, "Salário"
//   "comprei gasolina 80 reais"     → expense, 80, "Gasolina"

export interface VoicePrefill {
  description: string
  value: number
  type: 'expense' | 'income' | 'recover'
  date: string
  status: 'paid'
  category_id: null
  notes: null
  rawText: string
}

const INCOME_RE = /\b(recebi|recebeu|entrou|ganhei|ganhou|entrada|recebimento|salário|salario)\b/i

// Words to strip when building the description
const STRIP_RE = new RegExp(
  [
    // trigger verbs
    'gastei','paguei','comprei','recebi','ganhei','entrou','recebimento','entrada',
    // prepositions & articles
    'de','do','da','dos','das','no','na','nos','nas','em','num','numa',
    'o','a','os','as','um','uma','uns','umas',
    // currency words
    'reais','real','r\\$',
    // other fillers
    'para','por','com','sobre','uns','tipo',
  ].map(w => `\\b${w}\\b`).join('|'),
  'gi'
)

// Matches Brazilian number formats: 1.500,00 | 1500,00 | 1500.00 | 150 | 1.500
const NUMBER_RE = /\b(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\b/g

function parseBrNumber(raw: string): number {
  // "1.500,75" → 1500.75  |  "150,50" → 150.50  |  "1500" → 1500
  if (raw.includes(',')) {
    return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(raw)
}

export function parseVoiceInput(transcript: string): VoicePrefill {
  const text = transcript.trim()
  const lower = text.toLowerCase()

  // --- type ---
  const type: 'expense' | 'income' = INCOME_RE.test(lower) ? 'income' : 'expense'

  // --- value: pick the largest number found ---
  const numMatches = [...lower.matchAll(NUMBER_RE)]
  const value = numMatches.length
    ? Math.max(...numMatches.map(m => parseBrNumber(m[1])))
    : 0

  // --- description: strip filler words + numbers ---
  const desc = lower
    .replace(NUMBER_RE, ' ')
    .replace(STRIP_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const description = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : ''

  return {
    rawText: text,
    description,
    value,
    type,
    date: new Date().toISOString().slice(0, 10),
    status: 'paid',
    category_id: null,
    notes: null,
  }
}
