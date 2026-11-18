param(
    [Parameter(Position = 0)]
    [ValidateSet('setup', 'dev', 'test', 'quality', 'build', 'workflow', 'live', 'prototype')]
    [string]$Action = 'test'
)

$ErrorActionPreference = 'Stop'
$frontendPath = Join-Path $PSScriptRoot 'homework/8/frontend'
$previousPath = $env:Path
$script:pnpmCommand = $null

function Initialize-Toolchain {
    $nodeVersion = '24.22.3'
    $pnpmVersion = '11.25.0'
    $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $toolsRoot = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'HomeworkTools' } else { $null }
    $localNode = if ($toolsRoot) { Join-Path $toolsRoot "node/node-v$nodeVersion-win-$architecture/node.exe" } else { $null }
    $nodeCommand = if ($localNode -and (Test-Path -LiteralPath $localNode)) {
        $localNode
    } else {
        $existingNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existingNode) { $existingNode.Source }
    }

    if ($nodeCommand) {
        $versionText = & $nodeCommand --version
        if ($LASTEXITCODE -ne 0 -or [version]($versionText.TrimStart('v')) -lt [version]'22.12.0') {
            $nodeCommand = $null
        }
    }
    if (!$nodeCommand) {
        if ($Action -ne 'setup' -or !$toolsRoot) {
            throw 'Node.js 22.12+ was not found. Run .\defense.ps1 setup first, or install Node.js LTS.'
        }
        $archiveName = "node-v$nodeVersion-win-$architecture.zip"
        $downloadRoot = "https://nodejs.org/dist/v$nodeVersion"
        $archivePath = Join-Path ([IO.Path]::GetTempPath()) ("hw8-node-" + [guid]::NewGuid().ToString('N') + '.zip')
        Write-Output "Installing Node.js $nodeVersion in $toolsRoot (no system PATH changes)."
        try {
            # Windows PowerShell 5.1 may otherwise negotiate an obsolete TLS version.
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri "$downloadRoot/$archiveName" -OutFile $archivePath -UseBasicParsing
            $checksums = (Invoke-WebRequest -Uri "$downloadRoot/SHASUMS256.txt" -UseBasicParsing).Content
            $checksumLine = @($checksums -split '\r?\n' | Where-Object { $_ -match ('^[a-fA-F0-9]{64}\s+' + [regex]::Escape($archiveName) + '$') })
            if ($checksumLine.Count -ne 1) { throw 'Official Node.js checksum was not found.' }
            $expectedHash = ($checksumLine[0] -split '\s+')[0]
            if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) {
                throw 'Node.js archive checksum mismatch.'
            }
            $nodeRoot = Join-Path $toolsRoot 'node'
            New-Item -ItemType Directory -Path $nodeRoot -Force | Out-Null
            Expand-Archive -LiteralPath $archivePath -DestinationPath $nodeRoot -Force
        } finally {
            if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
        }
        $nodeCommand = $localNode
    }
    # Child processes need node on PATH; this is restored when this script exits.
    $env:Path = [IO.Path]::GetDirectoryName($nodeCommand) + [IO.Path]::PathSeparator + $env:Path

    $localPnpm = if ($toolsRoot) { Join-Path $toolsRoot 'pnpm/node_modules/.bin/pnpm.cmd' } else { $null }
    if ($localPnpm -and (Test-Path -LiteralPath $localPnpm)) {
        $script:pnpmCommand = $localPnpm
    } else {
        $existingPnpm = Get-Command pnpm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existingPnpm) { $script:pnpmCommand = $existingPnpm.Source }
    }
    if (!$script:pnpmCommand) {
        if ($Action -ne 'setup' -or !$toolsRoot) {
            throw 'pnpm was not found. Run .\defense.ps1 setup first.'
        }
        $npmCommand = Join-Path ([IO.Path]::GetDirectoryName($nodeCommand)) 'npm.cmd'
        if (!(Test-Path -LiteralPath $npmCommand)) {
            throw 'npm was not found next to node.exe. Install Node.js LTS with npm and retry setup.'
        }
        $pnpmRoot = Join-Path $toolsRoot 'pnpm'
        Write-Output "Installing pnpm $pnpmVersion in $pnpmRoot."
        & $npmCommand install --prefix $pnpmRoot --no-audit --no-fund "pnpm@$pnpmVersion"
        if ($LASTEXITCODE -ne 0) { throw "pnpm installation failed with exit code $LASTEXITCODE" }
        $script:pnpmCommand = $localPnpm
    }
    $env:Path = [IO.Path]::GetDirectoryName($script:pnpmCommand) + [IO.Path]::PathSeparator + $env:Path
    Write-Output "Node: $nodeCommand"
    Write-Output "pnpm: $script:pnpmCommand"
}

function Invoke-CheckedPnpm {
    param([string[]]$CommandArguments)
    & $script:pnpmCommand @CommandArguments
    if ($LASTEXITCODE -ne 0) { throw "pnpm failed with exit code $LASTEXITCODE" }
}

try {
    Initialize-Toolchain
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
                & node.exe (Join-Path $PSScriptRoot 'homework/8/tests/check-workflow.cjs')
                if ($LASTEXITCODE -ne 0) { throw "Workflow check failed with exit code $LASTEXITCODE" }
            }
            'prototype' {
                Set-Location (Join-Path $PSScriptRoot 'homework/8/prototype/v0')
                Invoke-CheckedPnpm -CommandArguments @('install', '--frozen-lockfile')
                Invoke-CheckedPnpm -CommandArguments @('dev')
            }
        }
    } finally { Pop-Location }
} finally {
    $env:Path = $previousPath
}
