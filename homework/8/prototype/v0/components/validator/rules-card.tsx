import { Check, Info, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { MAX_QUERY_LENGTH, validateQuery } from "@/lib/validator"

type RuleStatus = "pass" | "fail" | "info"

const EXAMPLES = [
  { query: "alp", result: "Alpha" },
  { query: "GA", result: "Gamma" },
  { query: "zzz", result: "пусто" },
  { query: "@@@", result: "ошибка" },
]

function RuleIcon({ status }: { status: RuleStatus }) {
  const Icon = status === "pass" ? Check : status === "fail" ? X : Info
  const label = status === "pass" ? "выполнено" : status === "fail" ? "нарушено" : "справка"
  return (
    <span
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
        status === "pass" && "bg-accent text-accent-foreground",
        status === "fail" && "bg-destructive/10 text-destructive",
        status === "info" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
    </span>
  )
}

type RulesCardProps = {
  query: string
  onExampleSelect: (query: string) => void
}

export function RulesCard({ query, onExampleSelect }: RulesCardProps) {
  const check = validateQuery(query)

  const rules: { title: string; detail: string; status: RuleStatus }[] = [
    {
      title: "Латинские буквы, цифры и пробельные символы",
      detail: "Кириллица, знаки препинания и спецсимволы недопустимы.",
      status: check.invalidChars.length > 0 ? "fail" : "pass",
    },
    {
      title: `Не более ${MAX_QUERY_LENGTH} символов`,
      detail: "Ввод не обрезается — превышение приводит к ошибке.",
      status: check.tooLong ? "fail" : "pass",
    },
    {
      title: "Пустая строка допустима",
      detail: "Показывает весь список.",
      status: "info",
    },
    {
      title: "Поиск по подстроке без учёта регистра",
      detail: "«GA» найдёт «Gamma».",
      status: "info",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Правила</CardTitle>
        <CardDescription>Отметки обновляются по мере ввода.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-col gap-3">
          {rules.map((rule) => (
            <li key={rule.title} className="flex gap-3">
              <RuleIcon status={rule.status} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{rule.title}</span>
                <span className="text-sm text-muted-foreground">{rule.detail}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Примеры
          </h3>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example.query}>
                <button
                  type="button"
                  onClick={() => onExampleSelect(example.query)}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={`Подставить пример «${example.query}», ожидается: ${example.result}`}
                >
                  <code className="font-mono font-medium">{example.query}</code>
                  <span aria-hidden="true" className="text-muted-foreground">
                    {"→"} {example.result}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
