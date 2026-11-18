"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DemoPanel } from "@/components/validator/demo-panel"
import { ResultsPanel } from "@/components/validator/results-panel"
import { RulesCard } from "@/components/validator/rules-card"
import { SearchForm } from "@/components/validator/search-form"
import type { SearchState, SearchStatus } from "@/components/validator/types"
import { buildRequestUrl, RequestError, searchItems } from "@/lib/mock-api"
import { filterItems, ITEMS, validateQuery, ValidationError } from "@/lib/validator"

const INITIAL_STATE: SearchState = {
  status: "idle",
  items: ITEMS,
  resultsQuery: null,
  lastSentQuery: null,
  validation: null,
  requestError: null,
}

const DEMO_RESULTS_QUERY = "alp"

const DEMO_QUERIES: Record<SearchStatus, string> = {
  idle: "",
  loading: "ga",
  success: "alp",
  empty: "zzz",
  "validation-error": "@@@",
  "request-error": "beta",
}

function settledStatus(state: SearchState): SearchStatus {
  if (state.requestError) return "request-error"
  if (state.resultsQuery === null) return "idle"
  return state.items.length > 0 ? "success" : "empty"
}

export function StringValidator() {
  const inputRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [query, setQuery] = useState("")
  const [state, setState] = useState<SearchState>(INITIAL_STATE)
  const [failNextRequest, setFailNextRequest] = useState(false)
  const [lastRequest, setLastRequest] = useState<string | null>(null)

  const isLoading = state.status === "loading"
  const isQueryChanged =
    state.status !== "validation-error" && query !== (state.lastSentQuery ?? "")

  const cancelPending = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  useEffect(() => cancelPending, [cancelPending])

  async function runSearch(rawQuery: string) {
    if (controllerRef.current || isLoading) return

    const validation = validateQuery(rawQuery)
    if (!validation.valid) {
      setState((prev) => ({ ...prev, status: "validation-error", validation }))
      inputRef.current?.focus()
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    const simulateFailure = failNextRequest
    if (simulateFailure) setFailNextRequest(false)

    setLastRequest(buildRequestUrl(rawQuery))
    setState((prev) => ({
      ...prev,
      status: "loading",
      lastSentQuery: rawQuery,
      validation: null,
      requestError: null,
    }))

    try {
      const items = await searchItems(rawQuery, { signal: controller.signal, simulateFailure })
      setState((prev) => ({
        ...prev,
        status: items.length > 0 ? "success" : "empty",
        items,
        resultsQuery: rawQuery,
      }))
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ValidationError) {
        setState((prev) => ({
          ...prev,
          status: "validation-error",
          validation: validateQuery(rawQuery),
        }))
      } else {
        setState((prev) => ({
          ...prev,
          status: "request-error",
          requestError:
            error instanceof RequestError ? error.message : "Неизвестная ошибка запроса.",
        }))
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setState((prev) =>
      prev.status === "validation-error"
        ? { ...prev, validation: null, status: settledStatus(prev) }
        : prev,
    )
  }

  function handleReset() {
    cancelPending()
    setQuery("")
    setState(INITIAL_STATE)
    inputRef.current?.focus()
  }

  function handleExampleSelect(example: string) {
    handleQueryChange(example)
    inputRef.current?.focus()
  }

  function handleDemoSelect(status: SearchStatus) {
    cancelPending()
    const demoQuery = DEMO_QUERIES[status]
    const previousResults = {
      items: filterItems(DEMO_RESULTS_QUERY, ITEMS),
      resultsQuery: DEMO_RESULTS_QUERY,
      lastSentQuery: DEMO_RESULTS_QUERY,
    }
    setQuery(demoQuery)

    switch (status) {
      case "idle":
        setState(INITIAL_STATE)
        break
      case "loading":
        setLastRequest(buildRequestUrl(demoQuery))
        setState({ ...INITIAL_STATE, ...previousResults, status, lastSentQuery: demoQuery })
        break
      case "success":
      case "empty":
        setLastRequest(buildRequestUrl(demoQuery))
        setState({
          ...INITIAL_STATE,
          status,
          items: filterItems(demoQuery, ITEMS),
          resultsQuery: demoQuery,
          lastSentQuery: demoQuery,
        })
        break
      case "validation-error":
        setState({
          ...INITIAL_STATE,
          ...previousResults,
          status,
          validation: validateQuery(demoQuery),
        })
        break
      case "request-error":
        setLastRequest(buildRequestUrl(demoQuery))
        setState({
          ...INITIAL_STATE,
          ...previousResults,
          status,
          lastSentQuery: demoQuery,
          requestError: "Сервер не ответил (имитация, код 503).",
        })
        break
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-6">
          <SearchForm
            inputRef={inputRef}
            query={query}
            onQueryChange={handleQueryChange}
            onSubmit={() => runSearch(query)}
            onReset={handleReset}
            isLoading={isLoading}
            isQueryChanged={isQueryChanged}
            validationError={state.status === "validation-error" ? state.validation : null}
          />
          <RulesCard query={query} onExampleSelect={handleExampleSelect} />
        </div>
        <ResultsPanel
          state={state}
          currentQuery={query}
          isQueryChanged={isQueryChanged}
          onRetry={() => runSearch(query)}
        />
      </div>
      <DemoPanel
        currentStatus={state.status}
        onSelect={handleDemoSelect}
        failNextRequest={failNextRequest}
        onFailNextRequestChange={setFailNextRequest}
        lastRequest={lastRequest}
      />
    </div>
  )
}
