export type Item = {
  id: string
  name: string
}

export const ITEMS: Item[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
  { id: "3", name: "Gamma" },
  { id: "4", name: "Delta" },
  { id: "5", name: "Omega" },
]

export const MAX_QUERY_LENGTH = 40

const ALLOWED_CHAR = /^[a-zA-Z0-9\s]$/u

export const INVALID_FILTER_CODE = "ValidationError.INVALID_FILTER"
export const INVALID_FILTER_MESSAGE =
  "Недопустимый фильтр. Используйте буквы, цифры и пробел, до 40 символов."

export class ValidationError extends Error {
  readonly code = INVALID_FILTER_CODE

  constructor() {
    super(INVALID_FILTER_MESSAGE)
    this.name = "ValidationError"
  }
}

export type ValidationResult = {
  valid: boolean
  length: number
  tooLong: boolean
  invalidChars: string[]
}

export function validateQuery(query: string): ValidationResult {
  const tooLong = !(query.length <= MAX_QUERY_LENGTH)
  const invalidChars = Array.from(
    new Set(Array.from(query).filter((char) => !ALLOWED_CHAR.test(char))),
  )
  return {
    valid: !tooLong && invalidChars.length === 0,
    length: query.length,
    tooLong,
    invalidChars,
  }
}

export function filterItems(query: string, items: Item[]): Item[] {
  if (!validateQuery(query).valid) throw new ValidationError()
  if (query === "") return items
  const lower = query.toLowerCase()
  return items.filter((item) => item.name.toLowerCase().includes(lower))
}
