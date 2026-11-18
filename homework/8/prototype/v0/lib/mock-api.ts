import { filterItems, ITEMS, type Item } from "@/lib/validator"

export const MOCK_DELAY_MS = 900

export class RequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RequestError"
  }
}

export function buildRequestUrl(query: string) {
  return `GET /api/items?query=${encodeURIComponent(query)}`
}

type SearchOptions = {
  signal?: AbortSignal
  simulateFailure?: boolean
}

export function searchItems(
  query: string,
  { signal, simulateFailure = false }: SearchOptions = {},
): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (simulateFailure) {
        reject(new RequestError("Сервер не ответил (имитация, код 503)."))
        return
      }
      try {
        resolve(filterItems(query, ITEMS))
      } catch (error) {
        reject(error)
      }
    }, MOCK_DELAY_MS)

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Запрос отменён", "AbortError"))
      },
      { once: true },
    )
  })
}
