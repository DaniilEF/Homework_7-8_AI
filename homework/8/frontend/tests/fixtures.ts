// Independent fixtures matching the real HTTP contract, not the filter implementation.
export const endpoint = 'https://validator.test/items'
export const alpha = { id: '1', name: 'Alpha' }
export const gamma = { id: '3', name: 'Gamma' }
export const omega = { id: '5', name: 'Omega' }
export const success = { items: [alpha] }
export const empty = { items: [] }
export const invalid = { error: { code: 'INVALID_FILTER', message: 'Недопустимый фильтр.' } }
export const failure = { error: { code: 'SERVICE_UNAVAILABLE', message: 'Сервис недоступен.' } }

export function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
