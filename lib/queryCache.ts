// Cache em memória compartilhado entre montagens de hooks (stale-while-revalidate).
// Permite mostrar dados já carregados instantaneamente ao voltar para uma aba,
// enquanto uma nova busca é feita em segundo plano.

const cache = new Map<string, unknown>()

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, data)
}

export function clearCache(): void {
  cache.clear()
}
