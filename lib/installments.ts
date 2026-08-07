export interface ParsedInstallment {
  base: string
  index: number
  total: number
}

export function parseInstallment(description: string): ParsedInstallment | null {
  const match = description.match(/^(.+?) \((\d+)\/(\d+)\)$/)
  if (!match) return null
  return { base: match[1], index: parseInt(match[2]), total: parseInt(match[3]) }
}

// Teto de sanidade: acima disso a descricao provavelmente nao e um parcelamento
// real, e gerar a lista de irmaos sairia caro sem necessidade.
const MAX_INSTALLMENTS = 360

/**
 * Descricoes exatas de todas as parcelas do grupo.
 *
 * Usar igualdade em vez de LIKE e proposital: `base` vem da descricao digitada
 * pelo usuario e pode conter `%` ou `_`, que num ilike viram curinga e fazem o
 * padrao casar com lancamentos de outros grupos — o que, num delete em lote,
 * apagaria dado nao relacionado.
 *
 * Retorna null quando o total esta fora de uma faixa plausivel.
 */
export function installmentGroupDescriptions(parsed: ParsedInstallment): string[] | null {
  if (!Number.isInteger(parsed.total) || parsed.total < 1 || parsed.total > MAX_INSTALLMENTS) {
    return null
  }
  return Array.from(
    { length: parsed.total },
    (_, i) => `${parsed.base} (${i + 1}/${parsed.total})`,
  )
}
