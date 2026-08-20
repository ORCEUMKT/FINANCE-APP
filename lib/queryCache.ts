// Cache em memória compartilhado entre montagens de hooks.
// Entradas expiram após TTL_MS; invalidateByPrefix remove chaves sob demanda
// e notifica assinantes para que os hooks afetados refaçam a busca imediatamente.

interface Entry<T> { data: T; ts: number }

const cache = new Map<string, Entry<unknown>>()
const TTL_MS = 5 * 60 * 1000

type InvalidationListener = (prefix: string) => void
const listeners = new Set<InvalidationListener>()

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key) as Entry<T> | undefined
  if (!entry) return undefined
  if (Date.now() - entry.ts > TTL_MS) { cache.delete(key); return undefined }
  return entry.data
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() })
}

export function clearCache(): void { cache.clear() }

/** Remove todas as entradas cujas chaves começam com `prefix` e notifica assinantes. */
export function invalidateByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  listeners.forEach((fn) => fn(prefix))
}

/** Assina eventos de invalidação. Retorna função de cancelamento (use em useEffect cleanup). */
export function subscribeInvalidation(fn: InvalidationListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
