import type { Item, ValidationResult } from "@/lib/validator"

export type SearchStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "validation-error"
  | "request-error"

export type SearchState = {
  status: SearchStatus
  /** Last successful result list; kept during loading and after errors. */
  items: Item[]
  /** Query the shown items belong to; null means the initial full list. */
  resultsQuery: string | null
  /** Last query actually sent to the (mock) server; null if nothing was sent. */
  lastSentQuery: string | null
  validation: ValidationResult | null
  requestError: string | null
}
