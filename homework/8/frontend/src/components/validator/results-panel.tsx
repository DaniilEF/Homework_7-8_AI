import { Loader2, RotateCw, SearchX, ServerCrash } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Item } from "@/lib/validator"
import type { SearchState } from "@/components/validator/types"

function HighlightedName({ name, query }: { name: string; query: string }) {
  const index = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (index === -1) return <>{name}</>
  return (
    <>
      {name.slice(0, index)}
      <mark className="rounded-sm bg-accent px-0.5 text-accent-foreground">
        {name.slice(index, index + query.length)}
      </mark>
      {name.slice(index + query.length)}
    </>
  )
}

function ItemList({ items, highlight }: { items: Item[]; highlight: string }) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="font-medium">
            <HighlightedName name={item.name} query={highlight} />
          </span>
          <span className="font-mono text-xs text-muted-foreground">id {item.id}</span>
        </li>
      ))}
    </ul>
  )
}

function EmptyResults() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-5" aria-hidden="true" />
      </span>
      <p className="font-medium">Ничего не найдено</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Измените запрос или нажмите «Сбросить», чтобы вернуть весь список.
      </p>
    </div>
  )
}

function quoted(query: string) {
  return query === "" ? "пустой запрос" : `«${query}»`
}

function resultsLabel(resultsQuery: string | null) {
  return resultsQuery === null ? "полный список (запрос не выполнялся)" : quoted(resultsQuery)
}

function statusMessage(state: SearchState) {
  switch (state.status) {
    case "idle":
      return `Исходное состояние. Показаны все элементы: ${state.items.length}.`
    case "loading":
      return `Выполняется поиск: ${quoted(state.lastSentQuery ?? "")}. Пока показаны прежние результаты.`
    case "success":
      return state.resultsQuery === ""
        ? `Пустой запрос — показаны все элементы: ${state.items.length}.`
        : `Найдено: ${state.items.length} по запросу «${state.resultsQuery}».`
    case "empty":
      return `По запросу «${state.resultsQuery}» ничего не найдено.`
    case "validation-error":
      return "Запрос не отправлен из-за ошибки валидации. Показаны прежние результаты."
    case "request-error":
      return "Не удалось выполнить запрос. Показаны последние успешные результаты."
  }
}

const BADGES: Record<SearchState["status"], { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
  idle: { label: "Исходное", variant: "secondary" },
  loading: { label: "Загрузка", variant: "outline" },
  success: { label: "Успех", variant: "default" },
  empty: { label: "Нет совпадений", variant: "outline" },
  "validation-error": { label: "Ошибка валидации", variant: "destructive" },
  "request-error": { label: "Ошибка запроса", variant: "destructive" },
}

type ResultsPanelProps = {
  state: SearchState
  currentQuery: string
  isQueryChanged: boolean
  onRetry: () => void
}

export function ResultsPanel({ state, currentQuery, isQueryChanged, onRetry }: ResultsPanelProps) {
  const badge = BADGES[state.status]
  const isLoading = state.status === "loading"
  const isStale = isLoading || isQueryChanged || state.status !== settledFor(state)

  return (
    <Card className="h-full" aria-busy={isLoading}>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Результаты</h2>
        </CardTitle>
        <CardDescription role="status" aria-live="polite" aria-atomic="true">
          {statusMessage(state)}
        </CardDescription>
        <CardAction>
          <Badge variant={badge.variant}>
            {isLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {badge.label}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state.status === "request-error" && (
          <Alert variant="destructive" className="items-start px-4 py-3">
            <ServerCrash aria-hidden="true" />
            <AlertTitle>Ошибка запроса</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <p>
                {state.requestError} Запрос {quoted(state.lastSentQuery ?? "")} не выполнен,
                введённый текст сохранён. «Повторить» отправит текущее значение поля:{" "}
                {quoted(currentQuery)}.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isLoading}>
                <RotateCw aria-hidden="true" />
                Повторить
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div
          id="results-query"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
        >
          <span>Результаты для:</span>
          <span className="font-mono font-medium text-foreground">{resultsLabel(state.resultsQuery)}</span>
          {isLoading && (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ожидание ответа на {quoted(state.lastSentQuery ?? "")}
            </span>
          )}
        </div>

        <div
          className={cn("transition-opacity", isLoading && "pointer-events-none opacity-50")}
          aria-describedby="results-query"
        >
          {state.items.length > 0 ? (
            <ItemList
              items={state.items}
              highlight={!isStale && state.resultsQuery ? state.resultsQuery : ""}
            />
          ) : (
            <EmptyResults />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function settledFor(state: SearchState): SearchState["status"] {
  if (state.resultsQuery === null) return "idle"
  return state.items.length > 0 ? "success" : "empty"
}
