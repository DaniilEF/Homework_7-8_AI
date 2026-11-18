# Homework 7–8 — валидатор строк и автоматизация n8n

Учебный проект продолжает валидатор из практики 5. Для ДЗ 8 реализован React-интерфейс по AI-прототипу v0: пользователь отправляет строку, n8n проверяет её и возвращает совпадения. Для ДЗ 7.1–7.2 подготовлены сценарии AI-ревью, классификации Issues и недельной отчётности.

## Материалы сдачи

| Задание | Отчёт | Материалы |
|---|---|---|
| 7.1 | [hw7.1.md](hw7.1.md) | Экспорты n8n, тестовый PR и скриншоты указаны в отчёте |
| 7.2 | [hw7.2.md](hw7.2.md) | [Workflows и подтверждения](homework/7.2/) |
| 8 | [hw8.md](hw8.md) | [Прототип](homework/8/prototype/), [код](homework/8/frontend/), [workflow](homework/8/workflows/), [скриншоты](homework/8/evidence/), [результаты тестов](homework/8/test-evidence/) |

Для защиты ДЗ 8: [короткий порядок демонстрации](homework/8/defense.md), [PowerShell-команды](defense.ps1), [Makefile](Makefile).

## ДЗ 8: установка и запуск

Стек: React, TypeScript, Vite, **shadcn/ui (Base UI)**, Tailwind CSS. Backend — опубликованный webhook n8n. Нужны Node.js 22.12+ или 24 LTS и pnpm. Для браузерных тестов — Google Chrome или установленный Playwright Chromium.

Из корня репозитория:

```powershell
cd homework/8/frontend
pnpm install --frozen-lockfile
# Только при первой настройке; существующий .env.local не перезаписывать:
Copy-Item .env.example .env.local
pnpm dev
```

Рабочий интерфейс: http://127.0.0.1:5173. В `.env.local` задаётся `VITE_ITEMS_WEBHOOK_URL`; после его изменения перезапустить Vite. В примере указан публичный учебный endpoint. Ключи не нужны, файл `.env.local` исключён из Git. Публикация workflow и формат ответа описаны в [контракте API](homework/8/api-contract.md).

Сценарии: `alp` → Alpha; `GA` → Gamma и Omega; `zzz` → пустой результат; `@@@` → ошибка. Пустая строка допустима и возвращает пять элементов. Поиск работает кнопкой и Enter. Сброс возвращает исходный список и фокус.

## Клиентские тесты и сборка

Из `homework/8/frontend`:

```powershell
pnpm test              # Vitest + Testing Library + MSW
pnpm test:e2e          # Playwright Test: desktop и mobile
pnpm test:all          # оба набора последовательно
pnpm test:quality      # намеренная поломка → падение → восстановление → успех
pnpm build            # TypeScript, включая тесты, и production-сборка
```

Изолированные тесты подменяют HTTP-ответы и не вызывают рабочий n8n. Playwright сам запускает сервер на свободном порту 5174. По умолчанию нужен установленный Chrome. Для Chromium:

```powershell
pnpm exec playwright install chromium
$env:PW_CHANNEL = 'chromium'
pnpm test:e2e
```

`test:quality` временно меняет SearchForm и восстанавливает его в finally с проверкой SHA-256. Запускать отдельно от других тестов и редактирования этого файла. Падение трёх проверок в сохранённом mutation-broken.log ожидаемое; финальный код восстановлен.

Подтверждённый результат: **25 Vitest и 4 Playwright прошли**, сборка прошла. [Описание проверок](homework/8/testing.md), [логи](homework/8/test-evidence/README.md).

Отдельно, при работающем приложении на 5173 и доступном n8n:

```powershell
pnpm test:live
```

Это живая интеграция с настоящими запросами. Проверка кода нод без обращения к n8n, из корня репозитория:

```powershell
node homework/8/tests/check-workflow.cjs
```

## Готовые команды защиты

Из корня в PowerShell:

```powershell
.\defense.ps1 setup
.\defense.ps1 dev
# В другом терминале:
.\defense.ps1 test
.\defense.ps1 quality
.\defense.ps1 build
```

`setup` на Windows проверяет Node.js и pnpm. Если они отсутствуют, загружает Node.js 24.22.3 с официального nodejs.org (с проверкой SHA-256) и устанавливает pnpm 11.25.0 через npm в `%LOCALAPPDATA%\HomeworkTools`. Права администратора и постоянное изменение PATH не требуются. Затем устанавливает зависимости и создаёт `.env.local`, только если файл отсутствует. Установленные так инструменты доступны всем действиям defense.ps1; прямые команды pnpm в отдельном терминале требуют обычной установки/PATH. Повторный `dev` проверяет владельца порта 5173: если это уже работающий Vite данного проекта, выводит его адрес без запуска второго экземпляра. Посторонний процесс не останавливается. Дополнительные действия: `workflow`, `live`, `prototype`. Если установлен make и PowerShell 7 (`pwsh`), доступны те же команды: `make setup`, `make dev`, `make test`, `make quality`, `make build`. Makefile вызывает тот же PowerShell-скрипт; отдельная установка make для ДЗ не требуется, если на защите используются готовые PowerShell-команды.

## AI-прототип

[ZIP v0](homework/8/prototype/v0-export.zip) сохранён без изменений. Для просмотра его исходников:

```powershell
cd homework/8/prototype/v0
pnpm install --frozen-lockfile
pnpm dev
```

Открыть адрес Next.js (обычно http://127.0.0.1:3000). Это прототип с имитацией запроса, а не рабочая интеграция. [Промпты и исправления](homework/8/design.md).

## Исходная версия из практики 5

Статический интерфейс сохранён в `string-validator/ui`, его контракт — [contract.md](string-validator/contract.md), источник — [ORIGIN.md](string-validator/ORIGIN.md).

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory string-validator/ui
node --test string-validator/tests/test_filter.cjs
```

Страница: http://127.0.0.1:8000; исходные браузерные проверки: http://127.0.0.1:8000/index_test.html. Если python указывает на неработающий ярлык Windows, использовать установленный интерпретатор, например:

```powershell
& "$env:LOCALAPPDATA\Python\bin\python.exe" -m http.server 8000 --bind 127.0.0.1 --directory string-validator/ui
```

Эта версия сохранена для истории ДЗ 7; демонстрация ДЗ 8 выполняется на React-интерфейсе с порта 5173. Пароли, токены и локальные credentials n8n в репозиторий не добавляются.
