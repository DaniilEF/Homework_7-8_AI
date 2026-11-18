"use client"

import { FlaskConical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MOCK_DELAY_MS } from "@/lib/mock-api"
import type { SearchStatus } from "@/components/validator/types"

const DEMO_STATES: { status: SearchStatus; label: string }[] = [
  { status: "idle", label: "Исходное" },
  { status: "loading", label: "Загрузка" },
  { status: "success", label: "Успех" },
  { status: "empty", label: "Нет совпадений" },
  { status: "validation-error", label: "Ошибка валидации" },
  { status: "request-error", label: "Ошибка запроса" },
]

type DemoPanelProps = {
  currentStatus: SearchStatus
  onSelect: (status: SearchStatus) => void
  failNextRequest: boolean
  onFailNextRequestChange: (value: boolean) => void
  lastRequest: string | null
}

export function DemoPanel({
  currentStatus,
  onSelect,
  failNextRequest,
  onFailNextRequestChange,
  lastRequest,
}: DemoPanelProps) {
  return (
    <section aria-labelledby="demo-title">
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50/60 ring-0">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">
              <h2 id="demo-title">Демонстрация состояний</h2>
            </CardTitle>
            <Badge className="bg-amber-200 text-amber-950">
              <FlaskConical aria-hidden="true" />
              Только для прототипа
            </Badge>
          </div>
          <CardDescription>
            Переключает интерфейс в нужное состояние без ввода. Запросы имитируются с задержкой{" "}
            {MOCK_DELAY_MS} мс; демо-загрузка длится, пока не выбрано другое состояние.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div role="group" aria-label="Состояние интерфейса" className="flex flex-wrap gap-2">
            {DEMO_STATES.map((item) => {
              const isActive = item.status === currentStatus
              return (
                <Button
                  key={item.status}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  aria-pressed={isActive}
                  onClick={() => onSelect(item.status)}
                >
                  {item.label}
                </Button>
              )
            })}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="fail-next"
                checked={failNextRequest}
                onCheckedChange={(checked) => onFailNextRequestChange(checked)}
                aria-describedby="fail-next-hint"
              />
              <div className="flex flex-col">
                <Label htmlFor="fail-next">Сбой следующего запроса</Label>
                <span id="fail-next-hint" className="text-xs text-muted-foreground">
                  Срабатывает один раз — «Повторить» затем выполнится успешно.
                </span>
              </div>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              <span className="sr-only">Последний запрос: </span>
              {lastRequest ?? "Запросов ещё не было"}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
