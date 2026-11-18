import type { Item } from './validator'

export class RequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestError'
  }
}

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function searchItems(query: string, signal: AbortSignal): Promise<Item[]> {
  const endpoint = import.meta.env.VITE_ITEMS_WEBHOOK_URL
  if (!endpoint) throw new RequestError('Не настроен адрес сервиса. Обратитесь к владельцу приложения.')
  let url: URL
  try {
    url = new URL(endpoint)
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('protocol')
  } catch {
    throw new RequestError('Некорректный адрес сервиса. Обратитесь к владельцу приложения.')
  }
  url.searchParams.set('query', query)

  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
  } catch (error) {
    if (signal.aborted) throw error
    throw new RequestError('Сервис недоступен или не ответил вовремя. Повторите попытку.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new RequestError('Сервис вернул неожиданный ответ. Повторите попытку.')
  }
  if (!response.ok) {
    if (response.status === 400 && isRecord(body) && isRecord(body.error)
        && body.error.code === 'INVALID_FILTER' && typeof body.error.message === 'string') {
      throw new ApiValidationError(body.error.message)
    }
    throw new RequestError(`Не удалось выполнить запрос (HTTP ${response.status}). Повторите попытку.`)
  }
  if (!isRecord(body) || !Array.isArray(body.items)
      || !body.items.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string')
      || new Set(body.items.map(item => item.id)).size !== body.items.length) {
    throw new RequestError('Сервис вернул неожиданный формат данных. Повторите попытку.')
  }
  return body.items as Item[]
}
