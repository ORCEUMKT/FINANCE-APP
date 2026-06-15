export interface VoicePrefill {
  description: string
  value: number
  type: 'expense' | 'income' | 'recover'
  date: string
  status: 'paid' | 'pending'
  installments: number
  category_name: string | null
  category_id: null
  notes: string | null
  rawText: string
}

const INCOME_RE = /\b(recebi|recebeu|entrou|ganhei|ganhou|entrada|recebimento|salário|salario|receita)\b/i
const RECOVER_RE = /\b(recuperar|a recuperar|recupera[cç][aã]o)\b/i

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

const WORD_NUMBERS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60,
}

function pad(n: number) { return String(n).padStart(2, '0') }

function extractDate(text: string): { date: string; cleaned: string } {
  const today = new Date()
  const y = today.getFullYear()
  const todayStr = `${y}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  if (/\bhoje\b/.test(text))
    return { date: todayStr, cleaned: text.replace(/\bhoje\b/, ' ') }

  if (/\bontem\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() - 1)
    return { date: `${y}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, cleaned: text.replace(/\bontem\b/, ' ') }
  }

  if (/\bamanh[aã]\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    return { date: `${y}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, cleaned: text.replace(/\bamanh[aã]\b/, ' ') }
  }

  // "dia 17/6" or "17/6"
  const slashRe = /\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})\b/
  const slashM = text.match(slashRe)
  if (slashM) {
    const day = parseInt(slashM[1]), month = parseInt(slashM[2])
    return { date: `${y}-${pad(month)}-${pad(day)}`, cleaned: text.replace(slashM[0], ' ') }
  }

  // "dia 16 de fevereiro" / "dia 16 fevereiro"
  const monthNameRe = /\bdia\s+(\d{1,2})\s+(?:de\s+)?([a-záêçãõü]+)\b/
  const monthM = text.match(monthNameRe)
  if (monthM) {
    const day = parseInt(monthM[1])
    const month = MONTHS[monthM[2].toLowerCase()]
    if (month)
      return { date: `${y}-${pad(month)}-${pad(day)}`, cleaned: text.replace(monthM[0], ' ') }
  }

  // "dia 16"
  const dayRe = /\bdia\s+(\d{1,2})\b/
  const dayM = text.match(dayRe)
  if (dayM) {
    const day = parseInt(dayM[1])
    return { date: `${y}-${pad(today.getMonth()+1)}-${pad(day)}`, cleaned: text.replace(dayM[0], ' ') }
  }

  return { date: todayStr, cleaned: text }
}

function extractInstallments(text: string): { installments: number; cleaned: string } {
  // digit: "5 parcelas", "em 5 vezes", "5x"
  const digitRe = /\b(?:em\s+)?(\d+)\s*(?:x\b|parcelas?|vezes?)\b/i
  const digitM = text.match(digitRe)
  if (digitM) {
    const n = Math.min(60, Math.max(1, parseInt(digitM[1])))
    return { installments: n, cleaned: text.replace(digitM[0], ' ') }
  }

  // word number: "cinco parcelas", "em cinco vezes"
  const wordPattern = Object.keys(WORD_NUMBERS).join('|')
  const wordRe = new RegExp(`\\b(?:em\\s+)?(${wordPattern})\\s+(?:parcelas?|vezes?)\\b`, 'i')
  const wordM = text.match(wordRe)
  if (wordM) {
    const n = WORD_NUMBERS[wordM[1].toLowerCase()] ?? 1
    return { installments: Math.min(60, n), cleaned: text.replace(wordM[0], ' ') }
  }

  // "parcelado em 5" or "parcelado em cinco"
  const parcDigitRe = /\bparcelad[oa]\s+(?:em\s+)?(\d+)\b/i
  const parcDigitM = text.match(parcDigitRe)
  if (parcDigitM) {
    const n = Math.min(60, Math.max(1, parseInt(parcDigitM[1])))
    return { installments: n, cleaned: text.replace(parcDigitM[0], ' ') }
  }

  const parcWordRe = new RegExp(`\\bparcelad[oa]\\s+(?:em\\s+)?(${wordPattern})\\b`, 'i')
  const parcWordM = text.match(parcWordRe)
  if (parcWordM) {
    const n = WORD_NUMBERS[parcWordM[1].toLowerCase()] ?? 1
    return { installments: Math.min(60, n), cleaned: text.replace(parcWordM[0], ' ') }
  }

  return { installments: 1, cleaned: text }
}

function extractNotes(text: string): { notes: string | null; cleaned: string } {
  // "observação blah", "nota blah", "obs blah"
  const notesRe = /\b(?:observa[cç][aã]o|observa[cç]ao|notas?|obs)\s+(.+)$/i
  const m = text.match(notesRe)
  if (m) {
    return { notes: m[1].trim(), cleaned: text.replace(m[0], ' ') }
  }
  return { notes: null, cleaned: text }
}

function extractCategory(text: string): { category_name: string | null; cleaned: string } {
  // "categoria alimentação", "na categoria mercado", "categoria: mercado"
  const stopWords = 'dia|valor|parcelas?|vezes?|observa|notas?|pendente|pago|paga|tipo|despesa|receita|recuperar|\\d'
  const catRe = new RegExp(
    `\\b(?:na\\s+)?categoria\\s*:?\\s*([a-záàâãéêíóôõúüç]+(?:\\s+[a-záàâãéêíóôõúüç]+)*)(?=\\s+(?:${stopWords})|$)`,
    'i'
  )
  const m = text.match(catRe)
  if (m) {
    return { category_name: m[1].trim(), cleaned: text.replace(m[0], ' ') }
  }
  return { category_name: null, cleaned: text }
}

// Brazilian number formats: 1.500,00 | 1500,00 | 500 | 1.500
const NUMBER_RE = /\b(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\b/g

function parseBrNumber(raw: string): number {
  if (raw.includes(',')) return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return parseFloat(raw)
}

const STRIP_RE = new RegExp(
  [
    // action verbs
    'gastei','paguei','comprei','recebi','ganhei','entrou','recebimento','entrada',
    'adicionar','adicione','adiciona','registrar','registre','lançamento','lancamento',
    'quero','queria','preciso',
    // type/status keywords
    'receita','despesa','recuperar',
    'pendente','pago','paga','pagar',
    // date residuals
    'dia',
    // prepositions and articles
    'de','do','da','dos','das','no','na','nos','nas','em','num','numa',
    'o','a','os','as','um','uma','uns','umas',
    // currency
    'reais','real','valor','cifrão','cifrao',
    // fillers
    'para','por','com','sobre',
    // salary
    'salário','salario',
  ].map(w => `\\b${w}\\b`).join('|'),
  'gi'
)

export function parseVoiceInput(transcript: string): VoicePrefill {
  const rawText = transcript.trim()

  // Pre-process: remove R$ symbol (speech may say "R$55" → keep only 55)
  let text = rawText.toLowerCase().replace(/r\$\s*/g, ' ')

  // 1. Type
  let type: 'expense' | 'income' | 'recover' = 'expense'
  if (RECOVER_RE.test(text)) type = 'recover'
  else if (INCOME_RE.test(text)) type = 'income'

  // 2. Status
  const status: 'paid' | 'pending' = /\bpendente\b/i.test(text) ? 'pending' : 'paid'

  // 3. Notes (extract first so it doesn't interfere with other fields)
  const { notes, cleaned: c1 } = extractNotes(text)
  text = c1

  // 4. Category (extract before date/installments to avoid consuming numbers)
  const { category_name, cleaned: c2 } = extractCategory(text)
  text = c2

  // 5. Date (before number extraction to protect date digits)
  const { date, cleaned: c3 } = extractDate(text)
  text = c3

  // 6. Installments (before general number extraction)
  const { installments, cleaned: c4 } = extractInstallments(text)
  text = c4

  // 7. Value: largest number in remaining text
  const numMatches = [...text.matchAll(NUMBER_RE)]
  const value = numMatches.length ? Math.max(...numMatches.map(m => parseBrNumber(m[1]))) : 0

  // 8. Description: strip numbers + filler words from remaining text
  const desc = text
    .replace(NUMBER_RE, ' ')
    .replace(STRIP_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const description = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : ''

  return { rawText, description, value, type, date, status, installments, category_name, category_id: null, notes }
}
