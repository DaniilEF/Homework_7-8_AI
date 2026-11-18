"use client"

import type { FormEvent, KeyboardEvent, RefObject } from "react"
import { AlertCircle, Info, Loader2, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { INVALID_FILTER_MESSAGE, MAX_QUERY_LENGTH, type ValidationResult } from "@/lib/validator"

type SearchFormProps = {
  inputRef: RefObject<HTMLInputElement | null>
  query: string
  onQueryChange: (value: string) => void
  onSubmit: () => void
  onReset: () => void
  isLoading: boolean
  isQueryChanged: boolean
  validationError: ValidationResult | null
}

function formatChars(chars: string[]) {
  return chars.map((char) => `«${char}»`).join(", ")
}

export function SearchForm({
  inputRef,
  query,
  onQueryChange,
  onSubmit,
  onReset,
  isLoading,
  isQueryChanged,
  validationError,
}: SearchFormProps) {
  const isOverLimit = query.length > MAX_QUERY_LENGTH
  const hasError = validationError !== null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
      event.preventDefault()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Поиск</CardTitle>
        <CardDescription>
          Строка проверяется по правилам, затем выполняется поиск по списку.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="query">Строка для проверки</Label>
              <span
                id="query-counter"
                className={cn(
                  "font-mono text-xs tabular-nums text-muted-foreground",
                  isOverLimit && "font-medium text-destructive",
                )}
              >
                {query.length} / {MAX_QUERY_LENGTH}
                <span className="sr-only"> символов</span>
              </span>
            </div>
            <Input
              ref={inputRef}
              id="query"
              name="query"
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Например, alp"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={hasError || undefined}
              aria-describedby={cn("query-hint query-counter", hasError && "query-error")}
              className="h-10 font-mono text-base md:text-sm"
            />
            <p id="query-hint" className="text-xs text-muted-foreground">
              Нажмите Enter или кнопку «Проверить и найти».
            </p>
            <div role="status" aria-live="polite">
              {isQueryChanged && !validationError && (
                <p
                  id="query-changed"
                  className="flex items-center gap-2 rounded-lg border border-primary/25 bg-accent px-3 py-2 text-sm text-accent-foreground"
                >
                  <Info className="size-4 shrink-0" aria-hidden="true" />
                  Запрос изменён. Нажмите «Проверить и найти».
                </p>
              )}
            </div>
            {validationError && (
              <div
                id="query-error"
                role="alert"
                className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{INVALID_FILTER_MESSAGE}</p>
                  <ul className="flex flex-col gap-0.5 text-destructive/90">
                    {validationError.invalidChars.length > 0 && (
                      <li>Недопустимые символы: {formatChars(validationError.invalidChars)}</li>
                    )}
                    {validationError.tooLong && (
                      <li>
                        Длина {validationError.length} из {MAX_QUERY_LENGTH} допустимых.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              aria-disabled={isLoading}
              className="sm:flex-1"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
              {isLoading ? "Проверяем…" : "Проверить и найти"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={onReset}>
              <RotateCcw aria-hidden="true" />
              Сбросить
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
