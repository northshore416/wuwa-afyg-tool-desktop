import { spawn } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const binDir = path.join(root, 'node_modules', '.bin')
const isWindows = process.platform === 'win32'
const env = {
    ...process.env,
    PATH: binDir + path.delimiter + (process.env.PATH ?? ''),
    WUWA_DESKTOP: '1',
    WUWA_DATA_DIR: '.desktop-data'
}

const serverUrl = 'http://127.0.0.1:5173'
let viteProcess
let electronProcess

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: root,
            env,
            stdio: 'inherit',
            shell: isWindows
        })
        child.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`${command} 退出码 ${code}`))
        })
        child.on('error', reject)
    })
}

function start(command, args, extraEnv = {}) {
    const child = spawn(command, args, {
        cwd: root,
        env: { ...env, ...extraEnv },
        stdio: 'inherit',
        shell: isWindows
    })
    child.on('error', (error) => {
        console.error(error.message)
    })
    return child
}

function waitForServer(url, timeoutMs = 45000) {
    const startTime = Date.now()
    return new Promise((resolve, reject) => {
        const check = () => {
            const req = http.get(url, (res) => {
                res.resume()
                resolve()
            })
            req.on('error', () => {
                if (Date.now() - startTime > timeoutMs) {
                    reject(new Error(`等待开发服务器超时：${url}`))
                    return
                }
                setTimeout(check, 500)
            })
            req.setTimeout(1000, () => req.destroy())
        }
        check()
    })
}

function stopChild(child) {
    if (child && !child.killed) child.kill()
}

process.on('SIGINT', () => {
    stopChild(electronProcess)
    stopChild(viteProcess)
    process.exit(0)
})

process.on('SIGTERM', () => {
    stopChild(electronProcess)
    stopChild(viteProcess)
    process.exit(0)
})

async function main() {
    console.log('正在重建本地 SQLite 依赖...')
    await run('pnpm', ['rebuild', 'better-sqlite3'])

    console.log('正在启动 Vite 开发服务器...')
    viteProcess = start('vite', ['dev', '--host', '127.0.0.1'])
    await waitForServer(serverUrl)

    console.log('开发服务器已就绪，正在打开 Electron 窗口...')
    electronProcess = start('electron', ['.'], { ELECTRON_START_URL: serverUrl })
    electronProcess.on('exit', (code) => {
        stopChild(viteProcess)
        process.exit(code ?? 0)
    })
}

main().catch((error) => {
    stopChild(electronProcess)
    stopChild(viteProcess)
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
