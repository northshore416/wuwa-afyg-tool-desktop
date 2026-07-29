$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Has-Command($Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Step($Title, [scriptblock]$Action) {
    Write-Host ''
    Write-Host "== $Title ==" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Title 失败，退出码 $LASTEXITCODE"
    }
}

function Invoke-Pnpm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$PnpmArgs)

    if (Has-Command 'pnpm') {
        & pnpm @PnpmArgs
    } elseif (Has-Command 'corepack') {
        & corepack pnpm @PnpmArgs
    } else {
        throw '未找到 pnpm 或 corepack。请先安装 Node.js LTS。'
    }
}

function Show-Outputs {
    Write-Host ''
    Write-Host '打包完成，输出文件：' -ForegroundColor Green
    Get-ChildItem -LiteralPath (Join-Path $Root 'release') -Filter '*.exe' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object Name, Length, LastWriteTime |
        Format-Table -AutoSize
}

Write-Host ''
Write-Host '椰果工具箱用户端一键打包'
Write-Host '当前目录：' $Root

if (!(Has-Command 'node')) {
    Write-Host '未找到 node。请先安装 Node.js LTS：https://nodejs.org/' -ForegroundColor Red
    exit 1
}

if (!(Test-Path -LiteralPath (Join-Path $Root 'node_modules'))) {
    $InstallAnswer = Read-Host '未发现 node_modules，是否先安装依赖？直接回车=安装，输入 n 跳过'
    if ($InstallAnswer -notmatch '^(n|N|no|NO|否)$') {
        Invoke-Step '安装依赖' { Invoke-Pnpm install }
    }
}

Invoke-Step '类型检查' { Invoke-Pnpm run check }
Invoke-Step '构建前端与服务端' {
    try {
        $env:DEPLOY_TARGET = 'desktop'
        Invoke-Pnpm run build
    } finally {
        Remove-Item Env:\DEPLOY_TARGET -ErrorAction SilentlyContinue
    }
}

$Built = $false
$AsarPath = Join-Path $Root 'release\win-unpacked\resources\app.asar'

if (Test-Path -LiteralPath $AsarPath) {
    Write-Host ''
    Write-Host '检测到已有 win-unpacked，将跳过容易卡住的 Electron 外壳 packaging 阶段。' -ForegroundColor Yellow
    Invoke-Step '刷新 win-unpacked 应用包' { & node (Join-Path $Root 'scripts\refresh-win-unpacked-asar.mjs') }
    Invoke-Step '基于 win-unpacked 生成安装包与便携版' {
        Invoke-Pnpm exec electron-builder --win --x64 --publish never --prepackaged release\win-unpacked
    }
    $Built = $true
} else {
    try {
        Invoke-Step '生成安装包与便携版' { Invoke-Pnpm exec electron-builder --win --x64 --publish never }
        $Built = $true
    } catch {
        Write-Host ''
        Write-Host '常规打包失败，且没有可复用的 win-unpacked。请检查网络或关闭杀毒软件后重试。' -ForegroundColor Yellow
        throw $_
    }
}

if ($Built) {
    Show-Outputs
    Write-Host ''
    Write-Host '可以把 release 目录里的 Setup 安装包发给别人安装。' -ForegroundColor Green
}
