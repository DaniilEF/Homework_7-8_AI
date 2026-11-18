import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('.', import.meta.url))
const target = new URL('./src/components/validator/search-form.tsx', import.meta.url)
const original = readFileSync(target)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const source = original.toString('utf8')
const marker = '{validationError && ('
assert.equal(source.split(marker).length - 1, 1, 'Expected one validation message block')
const evidence = new URL('../test-evidence/', import.meta.url)
mkdirSync(evidence, { recursive: true })
const run = () => spawnSync(process.execPath, [
  fileURLToPath(new URL('./node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', 'tests/interface.test.tsx', '-t', 'without sending a request', '--reporter=verbose',
], { cwd: root, encoding: 'utf8', timeout: 60000, env: { ...process.env, NO_COLOR: '1' } })
let broken
try {
  // Deliberately hide the visible error; keep validation and request blocking intact.
  writeFileSync(target, source.replace(marker, '{false && ('))
  broken = run()
  writeFileSync(new URL('mutation-broken.log', evidence), (broken.stdout ?? '') + (broken.stderr ?? ''))
  assert.equal(broken.error, undefined, 'Vitest process must start and complete normally')
  assert.notEqual(broken.status, 0, 'Hiding the validation error must fail the test')
  assert.match((broken.stdout ?? '') + (broken.stderr ?? ''), /Unable to find.*alert/s,
    'Failure must be caused by the missing visible alert')
} finally {
  writeFileSync(target, original)
  assert.equal(hash(readFileSync(target)), hash(original), 'Source must be restored byte-for-byte')
}
const restored = run()
writeFileSync(new URL('mutation-restored.log', evidence), (restored.stdout ?? '') + (restored.stderr ?? ''))
assert.equal(restored.error, undefined)
assert.equal(restored.status, 0, 'Restored validation messages must pass the same tests')
const report = {
  recordedAt: new Date().toISOString(),
  mutation: 'Hide validation error message in SearchForm',
  test: 'without sending a request (three invalid-input cases)',
  brokenExitCode: broken.status,
  restoredExitCode: restored.status,
  originalSha256: hash(original),
  restoredSha256: hash(readFileSync(target)),
}
writeFileSync(new URL('mutation-result.json', evidence), JSON.stringify(report, null, 2) + '\n')
console.log('PASS: hidden validation message failed the tests; restored source passed. Source hash unchanged.')
