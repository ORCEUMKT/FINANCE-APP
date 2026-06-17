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
