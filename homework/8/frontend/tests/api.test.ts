import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ApiValidationError, RequestError, searchItems } from '../src/lib/api'
import { validateQuery } from '../src/lib/validator'
import { server } from './server'
import { endpoint, invalid } from './fixtures'

describe('HTTP-контракт и границы валидации', () => {
  it.each([
    { items: [{ id: 1, name: 'Alpha' }] },
    { items: [{ id: '1', name: 123 }] },
    { items: [{ id: '1', name: 'A' }, { id: '1', name: 'B' }] },
    { body: { items: [] } },
    [],
  ])('rejects malformed success data %#', async body => {
    server.use(http.get(endpoint, () => HttpResponse.json(body)))
    await expect(searchItems('alp', new AbortController().signal)).rejects.toThrow('неожиданный формат данных')
  })

  it('handles a non-JSON response as a request error', async () => {
    server.use(http.get(endpoint, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })))
    await expect(searchItems('alp', new AbortController().signal)).rejects.toBeInstanceOf(RequestError)
  })

  it('recognises the real HTTP 400 error envelope', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(invalid, { status: 400 })))
    await expect(searchItems('alp', new AbortController().signal)).rejects.toBeInstanceOf(ApiValidationError)
  })

  it('explains missing API configuration without making a request', async () => {
    vi.stubEnv('VITE_ITEMS_WEBHOOK_URL', '')
    await expect(searchItems('alp', new AbortController().signal)).rejects.toThrow('Не настроен адрес сервиса')
  })

  it('accepts 40 allowed characters and rejects 40 letters followed by newline', () => {
    expect(validateQuery('a'.repeat(40)).valid).toBe(true)
    expect(validateQuery('a'.repeat(39) + '\n').valid).toBe(true)
    expect(validateQuery('a'.repeat(40) + '\n').valid).toBe(false)
  })
})
