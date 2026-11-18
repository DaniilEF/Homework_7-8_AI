import { expect, test } from '@playwright/test'

const endpoint = 'https://validator.test/items'
const alpha = { id: '1', name: 'Alpha' }
const gamma = { id: '3', name: 'Gamma' }
const omega = { id: '5', name: 'Omega' }

test('keyboard scenario: input → server result → empty → validation → reset', async ({ page }) => {
  const queries: string[] = []
  await page.route(`${endpoint}**`, async route => {
    const query = new URL(route.request().url()).searchParams.get('query') ?? ''
    queries.push(query)
    await route.fulfill({ json: { items: query === 'alp' ? [alpha] : [] } })
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Строка для проверки' })
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()
  await input.fill('alp')
  await input.press('Enter')
  await expect(page.getByText('Найдено: 1 по запросу «alp».', { exact: true })).toBeVisible()
  await input.fill('zzz')
  await input.press('Enter')
  await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible()
  await input.fill('@@@')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Недопустимый фильтр')
  await expect(input).toHaveValue('@@@')
  expect(queries).toEqual(['alp', 'zzz'])
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click()
  await expect(input).toBeEmpty()
  await expect(input).toBeFocused()
  await expect(page.getByText('Исходное состояние. Показаны все элементы: 5.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('loading prevents duplicate requests and HTTP error can be retried with current input', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const queries: string[] = []
  await page.route(`${endpoint}**`, async route => {
    const query = new URL(route.request().url()).searchParams.get('query') ?? ''
    queries.push(query)
    if (queries.length === 1) {
      await gate
      await route.fulfill({ status: 500, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Сервис недоступен.' } } })
    } else {
      await route.fulfill({ json: { items: [gamma, omega] } })
    }
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Строка для проверки' })
  await input.fill('alp')
  try {
    await page.getByRole('button', { name: 'Проверить и найти', exact: true }).click({ clickCount: 2 })
    await expect.poll(() => queries.length).toBe(1)
    await expect(page.getByRole('button', { name: 'Проверяем…' })).toBeDisabled()
    await input.press('Enter')
    await input.press('Enter')
    expect(queries).toEqual(['alp'])
    await expect(page.getByText('Alpha', { exact: true })).toBeVisible()
  } finally { release() }
  await expect(page.getByText(/Не удалось выполнить запрос \(HTTP 500\)/)).toBeVisible()
  await expect(input).toHaveValue('alp')
  await input.fill('GA')
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.getByText('Найдено: 2 по запросу «GA».', { exact: true })).toBeVisible()
  expect(queries).toEqual(['alp', 'GA'])
})
