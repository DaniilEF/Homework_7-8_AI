import { useCallback, useEffect, useRef, useState } from 'react'
import { ResultsPanel } from './results-panel'
import { RulesCard } from './rules-card'
import { SearchForm } from './search-form'
import type { SearchState } from './types'
import { ApiValidationError, RequestError, searchItems } from '@/lib/api'
import { ITEMS, validateQuery } from '@/lib/validator'

const INITIAL_STATE: SearchState = {
  status: 'idle', items: ITEMS, resultsQuery: null, lastSentQuery: null,
  validation: null, requestError: null,
}

export function StringValidator() {
  const inputRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>(INITIAL_STATE)
  const isLoading = state.status === 'loading'
  const isQueryChanged = state.status !== 'validation-error' && query !== (state.lastSentQuery ?? '')

  const cancelPending = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])
  useEffect(() => cancelPending, [cancelPending])

  async function runSearch(rawQuery: string) {
    // Ref is synchronous: repeated submits in the same render cannot start another request.
    if (controllerRef.current) return
    const validation = validateQuery(rawQuery)
    if (!validation.valid) {
      setState(prev => ({ ...prev, status: 'validation-error', validation, requestError: null }))
      inputRef.current?.focus()
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setState(prev => ({ ...prev, status: 'loading', lastSentQuery: rawQuery, validation: null, requestError: null }))
    try {
      const items = await searchItems(rawQuery, controller.signal)
      // Reset/unmount/new request must never be overwritten by an obsolete response.
      if (controller.signal.aborted || controllerRef.current !== controller) return
      setState(prev => ({ ...prev, status: items.length ? 'success' : 'empty', items, resultsQuery: rawQuery }))
    } catch (error) {
      if (controller.signal.aborted || controllerRef.current !== controller) return
      if (error instanceof ApiValidationError) {
        setState(prev => ({ ...prev, status: 'validation-error', validation: { ...validateQuery(rawQuery), valid: false } }))
        inputRef.current?.focus()
      } else {
        setState(prev => ({ ...prev, status: 'request-error', requestError: error instanceof RequestError ? error.message : 'Не удалось выполнить запрос. Повторите попытку.' }))
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setState(prev => prev.status === 'validation-error' ? {
      ...prev, validation: null,
      status: prev.resultsQuery === null ? 'idle' : prev.items.length ? 'success' : 'empty',
    } : prev)
  }

  function handleReset() {
    cancelPending()
    setQuery('')
    setState(INITIAL_STATE)
    inputRef.current?.focus()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-6">
        <SearchForm inputRef={inputRef} query={query} onQueryChange={handleQueryChange}
          onSubmit={() => runSearch(query)} onReset={handleReset} isLoading={isLoading}
          isQueryChanged={isQueryChanged} validationError={state.status === 'validation-error' ? state.validation : null} />
        <RulesCard query={query} onExampleSelect={value => { handleQueryChange(value); inputRef.current?.focus() }} />
      </div>
      <ResultsPanel state={state} currentQuery={query} isQueryChanged={isQueryChanged} onRetry={() => runSearch(query)} />
    </div>
  )
}
