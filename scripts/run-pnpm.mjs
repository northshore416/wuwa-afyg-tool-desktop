import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function commandExists(command) {
    const pathExt = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', '.ps1', ''] : ['']
    const pathDirs = (process.env.PATH ?? '').split(path.delimiter)
    return pathDirs.some((dir) => pathExt.some((ext) => fs.existsSync(path.join(dir, command + ext))))
}

function spawnInherited(command, commandArgs, options = {}) {
    const child = spawn(command, commandArgs, {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        ...options
    })
    child.on('exit', (code) => process.exit(code ?? 1))
    child.on('error', (error) => {
        console.error(error.message)
        process.exit(1)
    })
}

if (commandExists('pnpm')) {
    spawnInherited('pnpm', args)
} else if (commandExists('corepack')) {
    spawnInherited('corepack', ['pnpm', ...args])
} else if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    spawnInherited('node', [process.env.npm_execpath, ...args])
} else {
    console.error('未找到 pnpm 或 corepack。请先安装 Node.js LTS。')
    process.exit(1)
}
