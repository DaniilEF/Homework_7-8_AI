param(
    [Parameter(Position = 0)]
    [ValidateSet('setup', 'dev', 'test', 'quality', 'build', 'workflow', 'live', 'prototype')]
    [string]$Action = 'test'
)

$ErrorActionPreference = 'Stop'
$frontendPath = Join-Path $PSScriptRoot 'homework/8/frontend'

function Invoke-CheckedPnpm {
    param([string[]]$CommandArguments)
    & pnpm @CommandArguments
    if ($LASTEXITCODE -ne 0) { throw "pnpm failed with exit code $LASTEXITCODE" }
}

Push-Location $frontendPath
try {
    switch ($Action) {
        'setup' {
            Invoke-CheckedPnpm -CommandArguments @('install', '--frozen-lockfile')
            if (!(Test-Path -LiteralPath '.env.local')) {
                Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
                Write-Output 'Created .env.local from the public example.'
            } else {
                Write-Output 'Keeping existing .env.local.'
            }
        }
        'dev' { Invoke-CheckedPnpm -CommandArguments @('dev') }
        'test' { Invoke-CheckedPnpm -CommandArguments @('test:all') }
        'quality' { Invoke-CheckedPnpm -CommandArguments @('test:quality') }
        'build' { Invoke-CheckedPnpm -CommandArguments @('build') }
        'live' { Invoke-CheckedPnpm -CommandArguments @('test:live') }
        'workflow' {
            & node (Join-Path $PSScriptRoot 'homework/8/tests/check-workflow.cjs')
            if ($LASTEXITCODE -ne 0) { throw "Workflow check failed with exit code $LASTEXITCODE" }
        }
        'prototype' {
            Set-Location (Join-Path $PSScriptRoot 'homework/8/prototype/v0')
            Invoke-CheckedPnpm -CommandArguments @('install', '--frozen-lockfile')
            Invoke-CheckedPnpm -CommandArguments @('dev')
        }
    }
} finally {
    Pop-Location
}
