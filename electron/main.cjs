const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

let mainWindow
let serverProcess

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.unref()
        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            server.close(() => resolve(address.port))
        })
    })
}

function waitForServer(url, timeoutMs = 30000) {
    const start = Date.now()

    return new Promise((resolve, reject) => {
        const check = () => {
            const req = http.get(url, (res) => {
                res.resume()
                resolve()
            })

            req.on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    reject(new Error(`Timed out waiting for ${url}`))
                    return
                }
                setTimeout(check, 250)
            })

            req.setTimeout(1000, () => {
                req.destroy()
            })
        }

        check()
    })
}

async function startSvelteKitServer() {
    const port = await getFreePort()
    const serverEntry = path.join(app.getAppPath(), 'build', 'index.js')
    const serverUrl = `http://127.0.0.1:${port}`

    serverProcess = spawn(process.execPath, [serverEntry], {
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            HOST: '127.0.0.1',
            PORT: String(port),
            NODE_ENV: 'production',
            WUWA_DESKTOP: '1',
            WUWA_APP_PACKAGED: '1',
            WUWA_DATA_DIR: app.getPath('userData')
        },
        stdio: 'ignore',
        windowsHide: true
    })

    serverProcess.once('exit', (code) => {
        if (code !== 0 && !app.isQuitting) app.quit()
    })

    await waitForServer(serverUrl)
    return serverUrl
}

function createWindow(url) {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 980,
        minHeight: 680,
        backgroundColor: '#1e1b2e',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        shell.openExternal(targetUrl)
        return { action: 'deny' }
    })

    mainWindow.loadURL(url)
}

app.whenReady().then(async () => {
    const url = app.isPackaged
        ? await startSvelteKitServer()
        : process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173'
    createWindow(url)

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(url)
    })
})

app.on('before-quit', () => {
    app.isQuitting = true
    if (serverProcess && !serverProcess.killed) serverProcess.kill()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
