import { ShieldCheck } from "lucide-react"
import { StringValidator } from "@/components/validator/string-validator"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Валидатор строк
          </h1>
          <p className="text-pretty text-muted-foreground">
            Проверка строки по правилам и поиск совпадений в списке элементов.
          </p>
        </div>
      </header>
      <StringValidator />
    </main>
  )
}
