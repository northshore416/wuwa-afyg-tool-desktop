import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const REPO_OWNER = 'northshore416'
const REPO_NAME = 'wuwa-afyg-tool-desktop'
const REPO_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
const REPO_RELEASES = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`
const USER_AGENT = 'WUWA-AFYG-Desktop-Updater'

interface GitHubReleaseAsset {
    name: string
    browser_download_url?: string
    size?: number
}

interface GitHubRelease {
    tag_name: string
    html_url: string
    assets: GitHubReleaseAsset[]
}

export interface AppUpdateStatus {
    ok: true
    packaged: boolean
    currentVersion: string
    latestVersion: string
    updateAvailable: boolean
    releaseUrl: string
    assetName: string | null
    assetUrl: string | null
}

function currentVersion() {
    return normalizeVersion(process.env.WUWA_APP_VERSION || '0.0.0')
}

function normalizeVersion(value: string) {
    return value.trim().replace(/^v/i, '')
}

function compareVersions(a: string, b: string) {
    const aa = normalizeVersion(a).split('.').map((n) => Number(n) || 0)
    const bb = normalizeVersion(b).split('.').map((n) => Number(n) || 0)
    const len = Math.max(aa.length, bb.length)
    for (let i = 0; i < len; i++) {
        const diff = (aa[i] ?? 0) - (bb[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

function isPackagedApp() {
    return process.env.WUWA_APP_PACKAGED === '1'
}

function dataDir() {
    return process.env.WUWA_DATA_DIR || path.join(os.homedir(), 'AppData', 'Roaming', 'WUWA AFYG Tool')
}

async function latestRelease(): Promise<GitHubRelease> {
    const res = await fetch(REPO_API, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`GitHub Release API ${res.status}`)
    const data = (await res.json()) as GitHubRelease
    if (!data.tag_name) throw new Error('GitHub Release response missing tag_name')
    return data
}

function pickWindowsInstaller(release: GitHubRelease) {
    return (
        release.assets.find((asset) => /setup.*\.exe$/i.test(asset.name)) ??
        release.assets.find((asset) => /\.exe$/i.test(asset.name)) ??
        null
    )
}

export async function getAppUpdateStatus(): Promise<AppUpdateStatus> {
    const release = await latestRelease()
    const asset = pickWindowsInstaller(release)
    const latestVersion = normalizeVersion(release.tag_name)
    const current = currentVersion()

    return {
        ok: true,
        packaged: isPackagedApp(),
        currentVersion: current,
        latestVersion,
        updateAvailable: compareVersions(latestVersion, current) > 0,
        releaseUrl: release.html_url || REPO_RELEASES,
        assetName: asset?.name ?? null,
        assetUrl: asset?.browser_download_url ?? null
    }
}

async function downloadFile(url: string, destination: string) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok || !res.body) throw new Error(`下载安装包失败：HTTP ${res.status}`)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(destination))
}

function psLiteral(value: string) {
    return "'" + value.replace(/'/g, "''") + "'"
}

async function writeUpdateScript(installerPath: string, appExe: string) {
    const scriptPath = path.join(dataDir(), 'updates', 'apply-update.ps1')
    const script = `
$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds 2
$installer = ${psLiteral(installerPath)}
$app = ${psLiteral(appExe)}
Start-Process -FilePath $installer -ArgumentList '/S' -Wait
Start-Sleep -Seconds 1
if (Test-Path -LiteralPath $app) {
    Start-Process -FilePath $app
}
`
    await fs.writeFile(scriptPath, script.trimStart(), 'utf8')
    return scriptPath
}

function runDetached(command: string, args: string[]) {
    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    })
    child.unref()
}

export async function installLatestAppVersion() {
    const status = await getAppUpdateStatus()
    if (!status.packaged) {
        throw new Error('开发版不能自动安装更新，请拉取源码后重新运行开发版。')
    }
    if (!status.assetUrl || !status.assetName) {
        throw new Error('最新版 Release 中没有找到 Windows 安装包。')
    }
    if (!status.updateAvailable) {
        return { ...status, downloaded: false, message: `当前已是最新版本 ${status.currentVersion}` }
    }

    const updatesDir = path.join(dataDir(), 'updates')
    const installerPath = path.join(updatesDir, status.assetName)
    await downloadFile(status.assetUrl, installerPath)

    const appExe = process.env.WUWA_APP_EXE || process.execPath
    const scriptPath = await writeUpdateScript(installerPath, appExe)
    runDetached('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath])

    setTimeout(() => process.exit(42), 800)

    return {
        ...status,
        downloaded: true,
        installerPath,
        message: `已下载 ${status.latestVersion}，即将关闭当前程序并安装更新。`
    }
}