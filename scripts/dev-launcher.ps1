$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Has-Command($Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Short-Commit($Commit) {
    if ([string]::IsNullOrWhiteSpace($Commit)) { return '未记录' }
    return $Commit.Substring(0, [Math]::Min(7, $Commit.Length))
}

function Invoke-Pnpm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$PnpmArgs)

    if (Has-Command 'pnpm') {
        & pnpm @PnpmArgs
    } elseif (Has-Command 'corepack') {
        & corepack pnpm @PnpmArgs
    } else {
        throw '未找到 pnpm 或 corepack。请先安装 Node.js LTS，或执行 corepack enable。'
    }

    if ($LASTEXITCODE -ne 0) {
        throw "pnpm 执行失败，退出码 $LASTEXITCODE"
    }
}

function Get-AppliedCommit {
    $StateFile = Join-Path $Root '.kernel\state.json'
    if (!(Test-Path -LiteralPath $StateFile)) { return $null }
    try {
        $State = Get-Content -LiteralPath $StateFile -Encoding UTF8 -Raw | ConvertFrom-Json
        return $State.appliedCommit
    } catch {
        return $null
    }
}

function Get-RemoteCommit {
    $Output = & git ls-remote https://github.com/d4rkOfficial/wuwa-afyg-tool.git refs/heads/main 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($Output | Out-String) }
    $Line = ($Output | Select-Object -First 1).ToString()
    return ($Line -split "\s+")[0]
}

Write-Host ''
Write-Host '椰果工具箱开发版启动器'
Write-Host '当前目录：' $Root
Write-Host ''

if (!(Has-Command 'node')) {
    Write-Host '未找到 node。请先安装 Node.js LTS：https://nodejs.org/' -ForegroundColor Red
    exit 1
}

if (!(Has-Command 'pnpm')) {
    if (Has-Command 'corepack') {
        Write-Host '未找到全局 pnpm，将通过 corepack 临时调用 pnpm。'
        try {
            & corepack prepare pnpm@latest --activate | Out-Host
        } catch {
            Write-Host 'corepack prepare 失败，后续会继续尝试 corepack pnpm。' -ForegroundColor Yellow
        }
    }
}

if (!(Test-Path -LiteralPath (Join-Path $Root 'node_modules'))) {
    $InstallAnswer = Read-Host '未发现 node_modules，是否先安装依赖？直接回车=安装，输入 n 跳过'
    if ($InstallAnswer -notmatch '^(n|N|no|NO|否)$') {
        Invoke-Pnpm install
    }
}

if (Has-Command 'git') {
    try {
        Write-Host '正在检查上游内核更新...'
        $LatestCommit = Get-RemoteCommit
        $AppliedCommit = Get-AppliedCommit

        if ($AppliedCommit -ne $LatestCommit) {
            Write-Host ("发现内核更新：当前 {0} -> 最新 {1}" -f (Short-Commit $AppliedCommit), (Short-Commit $LatestCommit)) -ForegroundColor Yellow
            $Answer = Read-Host '是否现在更新内核？直接回车=更新，输入 n 跳过'
            if ($Answer -notmatch '^(n|N|no|NO|否)$') {
                & node (Join-Path $Root 'scripts\kernel-update.mjs')
                if ($LASTEXITCODE -ne 0) { throw "内核更新失败，退出码 $LASTEXITCODE" }
            } else {
                Write-Host '已跳过内核更新。'
            }
        } else {
            Write-Host ("内核已是最新：{0}" -f (Short-Commit $LatestCommit)) -ForegroundColor Green
        }
    } catch {
        Write-Host '检查或更新内核失败，可能是网络或 GitHub 连接问题。' -ForegroundColor Yellow
        Write-Host $_
        $Continue = Read-Host '是否继续启动开发版？直接回车=继续，输入 n 退出'
        if ($Continue -match '^(n|N|no|NO|否)$') { exit 1 }
    }
} else {
    Write-Host '未找到 git，已跳过内核更新检查。需要自动更新内核请安装 Git for Windows。' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '正在启动开发版窗口...'
Invoke-Pnpm run desktop:dev
