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

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

function pad(n: number) { return String(n).padStart(2, '0') }

function extractDate(lower: string): { date: string; cleaned: string } {
  const today = new Date()
  const y = today.getFullYear()
  const todayStr = `${y}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  // "hoje"
  if (/\bhoje\b/.test(lower)) {
    return { date: todayStr, cleaned: lower.replace(/\bhoje\b/, ' ') }
  }

  // "ontem"
  if (/\bontem\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() - 1)
    return { date: `${y}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, cleaned: lower.replace(/\bontem\b/, ' ') }
  }

  // "amanhã" / "amanha"
  if (/\bamanh[aã]\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    return { date: `${y}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, cleaned: lower.replace(/\bamanh[aã]\b/, ' ') }
  }

  // "dia 16/2" ou "16/02"
  const slashRe = /\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})\b/
  const slashM = lower.match(slashRe)
  if (slashM) {
    const day = parseInt(slashM[1]), month = parseInt(slashM[2])
    return {
      date: `${y}-${pad(month)}-${pad(day)}`,
      cleaned: lower.replace(slashM[0], ' '),
    }
  }

  // "dia 16 de fevereiro" / "dia 16 fevereiro"
  const monthNameRe = /\bdia\s+(\d{1,2})\s+(?:de\s+)?([a-záêçãõü]+)\b/
  const monthM = lower.match(monthNameRe)
  if (monthM) {
    const day = parseInt(monthM[1])
    const month = MONTHS[monthM[2].toLowerCase()]
    if (month) {
      return {
        date: `${y}-${pad(month)}-${pad(day)}`,
        cleaned: lower.replace(monthM[0], ' '),
      }
    }
  }

  // "dia 16" (mês atual)
  const dayRe = /\bdia\s+(\d{1,2})\b/
  const dayM = lower.match(dayRe)
  if (dayM) {
    const day = parseInt(dayM[1])
    const month = today.getMonth() + 1
    return {
      date: `${y}-${pad(month)}-${pad(day)}`,
      cleaned: lower.replace(dayM[0], ' '),
    }
  }

  return { date: todayStr, cleaned: lower }
}

// Matches Brazilian number formats: 1.500,00 | 1500,00 | 500 | 1.500
const NUMBER_RE = /\b(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\b/g

function parseBrNumber(raw: string): number {
  if (raw.includes(',')) return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return parseFloat(raw)
}

const STRIP_RE = new RegExp(
  [
    // trigger verbs / action words
    'gastei','paguei','comprei','recebi','ganhei','entrou','recebimento','entrada',
    'adicionar','adicione','adiciona','registrar','registre',
    // date words (residual after extraction)
    'dia','valor','de','do','da','dos','das','no','na','nos','nas','em','num','numa',
    // articles
    'o','a','os','as','um','uma','uns','umas',
    // currency words
    'reais','real','r\\$',
    // fillers
    'para','por','com','sobre','tipo',
  ].map(w => `\\b${w}\\b`).join('|'),
  'gi'
)

export function parseVoiceInput(transcript: string): VoicePrefill {
  const text = transcript.trim()
  const lower = text.toLowerCase()

  // 1. type
  const type: 'expense' | 'income' = INCOME_RE.test(lower) ? 'income' : 'expense'

  // 2. extract date first (before number stripping)
  const { date, cleaned } = extractDate(lower)

  // 3. value: largest number in cleaned text
  const numMatches = [...cleaned.matchAll(NUMBER_RE)]
  const value = numMatches.length ? Math.max(...numMatches.map(m => parseBrNumber(m[1]))) : 0

  // 4. description: remove numbers + filler words
  const desc = cleaned
    .replace(NUMBER_RE, ' ')
    .replace(STRIP_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const description = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : ''

  return { rawText: text, description, value, type, date, status: 'paid', category_id: null, notes: null }
}
