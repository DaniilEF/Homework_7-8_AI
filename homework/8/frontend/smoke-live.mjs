// Explicit live check: sends real read-only requests to the configured n8n webhook.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let requestCount = 0
  page.on('request', request => {
    if (request.url().includes('/webhook/hw8-string-validator-items')) requestCount++
  })
  await page.goto(process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173')
  const input = page.getByRole('textbox', { name: 'Строка для проверки' })
  const submit = page.getByRole('button', { name: 'Проверить и найти', exact: true })
  await input.fill('alp')
  await submit.click()
  await page.getByText('Найдено: 1 по запросу «alp».', { exact: true }).waitFor()
  await input.fill('GA')
  await page.getByText('Запрос изменён. Нажмите «Проверить и найти».', { exact: true }).waitFor()
  await input.press('Enter')
  await page.getByText('Найдено: 2 по запросу «GA».', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-slot="card"]').last().getByRole('listitem').count(), 2)
  await input.fill('zzz')
  await submit.click()
  await page.getByText('По запросу «zzz» ничего не найдено.', { exact: true }).waitFor()
  await input.fill('')
  await submit.click()
  await page.getByText('Пустой запрос — показаны все элементы: 5.', { exact: true }).waitFor()

  const beforeInvalid = requestCount
  await input.fill('@@@')
  await submit.click()
  await page.getByRole('alert').waitFor()
  assert.equal(requestCount, beforeInvalid, 'Invalid input must not reach server')
  await input.fill('alp')
  assert.equal(await page.getByRole('alert').count(), 0)
  await context.setOffline(true)
  await submit.click()
  await page.getByRole('button', { name: 'Повторить', exact: true }).waitFor()
  assert.equal(await input.inputValue(), 'alp')
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await page.getByText('Найдено: 1 по запросу «alp».', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click()
  assert.equal(await input.inputValue(), '')
  assert.equal(await input.evaluate(element => document.activeElement === element), true)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/live-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: 'test-results/live-mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log(`PASS: live n8n search, Enter, empty, validation, offline/retry, reset/focus, mobile width; ${requestCount} request attempts.`)
} finally {
  await browser.close()
}
