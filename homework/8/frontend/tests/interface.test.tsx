import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import App from '../src/App'
import { server } from './server'
import { alpha, deferred, empty, endpoint, failure, gamma, invalid, omega, success } from './fixtures'

function start() {
  const user = userEvent.setup()
  render(<App />)
  const input = screen.getByRole('textbox', { name: 'Строка для проверки' })
  const button = screen.getByRole('button', { name: 'Проверить и найти' })
  return { user, input, button }
}
const foundAlpha = () => screen.findByText('Найдено: 1 по запросу «alp».', { exact: true })
const list = () => screen.getByText('Результаты', { exact: true }).closest('[data-slot="card"]') as HTMLElement

describe('Компоненты и взаимодействия', () => {
  it('shows the labelled form, rules and complete initial list', () => {
    const { input, button } = start()
    expect(screen.getByRole('heading', { name: 'Валидатор строк' })).toBeVisible()
    expect(input).toHaveAccessibleDescription(/Нажмите Enter/)
    expect(input).not.toBeRequired() // Empty query is explicitly valid in our contract.
    expect(button).toBeEnabled()
    expect(within(list()).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText(/0 \/ 40/)).toBeVisible()
  })

  it('selects an example, updates the counter and focuses input without submitting', async () => {
    let calls = 0
    server.use(http.get(endpoint, () => { calls++; return HttpResponse.json(success) }))
    const { user, input } = start()
    await user.click(screen.getByRole('button', { name: /Подставить пример «alp»/ }))
    expect(input).toHaveValue('alp')
    expect(input).toHaveFocus()
    expect(screen.getByText(/3 \/ 40/)).toBeVisible()
    expect(screen.getByText('Запрос изменён. Нажмите «Проверить и найти».')).toBeVisible()
    expect(calls).toBe(0)
  })

  it('submits with Enter and displays the returned list, then resets and restores focus', async () => {
    let received: string | null = null
    // Returning an item outside the local dataset proves the UI uses the HTTP response.
    server.use(http.get(endpoint, ({ request }) => {
      received = new URL(request.url).searchParams.get('query')
      return HttpResponse.json({ items: [{ id: 'remote-1', name: 'Remote match' }] })
    }))
    const { user, input } = start()
    await user.type(input, 'alp{Enter}')
    expect(await within(list()).findByText('Remote match')).toBeVisible()
    expect(received).toBe('alp')
    expect(within(list()).getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(within(list()).getAllByRole('listitem')).toHaveLength(5)
  })

  it('keeps results tied to the sent query while the input is edited', async () => {
    const { user, input, button } = start()
    await user.type(input, 'alp')
    await user.click(button)
    await foundAlpha()
    await user.clear(input)
    await user.type(input, 'zzz')
    expect(screen.getByText('Запрос изменён. Нажмите «Проверить и найти».')).toBeVisible()
    expect(screen.getByText('Найдено: 1 по запросу «alp».')).toBeVisible()
    expect(within(list()).getByText('Alpha')).toBeVisible()
  })
})

describe('Валидация формы', () => {
  it.each(['@@@', 'Привет', 'a'.repeat(41)])('rejects %s without sending a request and clears the old error on edit', async value => {
    let calls = 0
    server.use(http.get(endpoint, () => { calls++; return HttpResponse.json(success) }))
    const { user, input, button } = start()
    await user.type(input, value)
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Недопустимый фильтр')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveValue(value)
    expect(input).toHaveFocus()
    expect(calls).toBe(0)
    await user.clear(input)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('accepts an empty query and displays the full response', async () => {
    let query: string | null = null
    server.use(http.get(endpoint, ({ request }) => {
      query = new URL(request.url).searchParams.get('query')
      return HttpResponse.json({ items: [alpha, gamma, omega] })
    }))
    const { user, button } = start()
    await user.click(button)
    expect(await screen.findByText('Пустой запрос — показаны все элементы: 3.')).toBeVisible()
    expect(query).toBe('')
    expect(within(list()).getAllByRole('listitem')).toHaveLength(3)
  })

  it('accepts exactly 40 characters and sends the exact untrimmed value', async () => {
    const query = ' ' + 'a'.repeat(39)
    let received = ''
    server.use(http.get(endpoint, ({ request }) => {
      received = new URL(request.url).searchParams.get('query') ?? ''
      return HttpResponse.json(empty)
    }))
    const { user, input, button } = start()
    await user.type(input, query)
    await user.click(button)
    await screen.findByText('Ничего не найдено', { exact: true })
    expect(received).toBe(query)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a field error for server-side HTTP 400 even when local validation passed', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(invalid, { status: 400 })))
    const { user, input, button } = start()
    await user.type(input, 'alp')
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Недопустимый фильтр')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveValue('alp')
  })
})

describe('Подменённые ответы сервера и состояния', () => {
  it('shows an empty state for an empty HTTP 200 response', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(empty)))
    const { user, input, button } = start()
    await user.type(input, 'zzz')
    await user.click(button)
    expect(await screen.findByText('По запросу «zzz» ничего не найдено.')).toBeVisible()
    expect(within(list()).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows loading, preserves the previous list and permits only one request for double click and repeated Enter', async () => {
    const gate = deferred()
    let calls = 0
    server.use(http.get(endpoint, async () => { calls++; await gate.promise; return HttpResponse.json(success) }))
    const { user, input, button } = start()
    try {
      await user.type(input, 'alp')
      await user.dblClick(button)
      await waitFor(() => expect(calls).toBe(1))
      expect(screen.getByRole('button', { name: 'Проверяем…' })).toBeDisabled()
      expect(list()).toHaveAttribute('aria-busy', 'true')
      expect(within(list()).getAllByRole('listitem')).toHaveLength(5)
      await user.click(input)
      await user.keyboard('{Enter}{Enter}')
      expect(calls).toBe(1)
    } finally { gate.resolve() }
    await foundAlpha()
    expect(calls).toBe(1)
    expect(button).toBeEnabled()
    expect(list()).toHaveAttribute('aria-busy', 'false')
  })

  it('guards synchronous repeated submit events before React rerenders the disabled button', async () => {
    const gate = deferred()
    let calls = 0
    server.use(http.get(endpoint, async () => { calls++; await gate.promise; return HttpResponse.json(success) }))
    const { user, input } = start()
    await user.type(input, 'alp')
    try {
      act(() => {
        fireEvent.submit(input.closest('form')!)
        fireEvent.submit(input.closest('form')!)
      })
      await waitFor(() => expect(calls).toBe(1))
    } finally { gate.resolve() }
    await foundAlpha()
    expect(calls).toBe(1)
  })

  it('preserves input and previous results on HTTP 500, and retry sends the current input', async () => {
    const { user, input, button } = start()
    await user.type(input, 'alp')
    await user.click(button)
    await foundAlpha()
    server.use(http.get(endpoint, () => HttpResponse.json(failure, { status: 500 })))
    await user.clear(input)
    await user.type(input, 'beta')
    await user.click(button)
    expect(await screen.findByText(/Не удалось выполнить запрос \(HTTP 500\)/)).toBeVisible()
    expect(input).toHaveValue('beta')
    expect(within(list()).getByText('Alpha')).toBeVisible()
    await user.clear(input)
    await user.type(input, 'GA')
    let received: string | null = null
    server.use(http.get(endpoint, ({ request }) => {
      received = new URL(request.url).searchParams.get('query')
      return HttpResponse.json({ items: [gamma, omega] })
    }))
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Найдено: 2 по запросу «GA».')).toBeVisible()
    expect(received).toBe('GA')
    expect(within(list()).getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows a recoverable error on a network failure', async () => {
    server.use(http.get(endpoint, () => HttpResponse.error()))
    const { user, input, button } = start()
    await user.type(input, 'alp')
    await user.click(button)
    expect(await screen.findByText(/Сервис недоступен или не ответил вовремя/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeEnabled()
    expect(input).toHaveValue('alp')
  })

  it('cancels on reset and ignores an obsolete response while a new search is in progress', async () => {
    const oldGate = deferred()
    const newGate = deferred()
    let calls = 0
    server.use(http.get(endpoint, async ({ request }) => {
      calls++
      const query = new URL(request.url).searchParams.get('query')
      if (query === 'alp') { await oldGate.promise; return HttpResponse.json(success) }
      await newGate.promise
      return HttpResponse.json({ items: [gamma, omega] })
    }))
    const { user, input, button } = start()
    try {
      await user.type(input, 'alp')
      await user.click(button)
      await waitFor(() => expect(calls).toBe(1))
      await user.click(screen.getByRole('button', { name: 'Сбросить' }))
      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
      await user.type(input, 'GA')
      await user.click(button)
      await waitFor(() => expect(calls).toBe(2))
      await act(async () => { oldGate.resolve(); await oldGate.promise })
      expect(screen.getByRole('button', { name: 'Проверяем…' })).toBeDisabled()
    } finally { oldGate.resolve(); newGate.resolve() }
    expect(await screen.findByText('Найдено: 2 по запросу «GA».')).toBeVisible()
    expect(within(list()).getAllByRole('listitem')).toHaveLength(2)
  })
})
