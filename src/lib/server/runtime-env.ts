import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

let loaded = false
let protectedNames = new Set<string>()

const parseEnvFile = (path: string): void => {
    try {
        const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
        for (const rawLine of content.split(/\r?\n/)) {
            let line = rawLine.trim()
            if (!line || line.startsWith('#')) continue
            if (line.toLowerCase().startsWith('export ')) line = line.slice(7).trimStart()

            const separator = line.indexOf('=')
            if (separator <= 0) continue
            const name = line.slice(0, separator).trim()
            if (!/^YGKIT_[A-Z0-9_]+$/.test(name) || protectedNames.has(name)) continue

            let value = line.slice(separator + 1).trim()
            if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.at(-1) === value[0]) {
                value = value.slice(1, -1)
            }
            process.env[name] = value
        }
    } catch {
        // Optional runtime env files are allowed to be absent.
    }
}

export const loadYGKitRuntimeEnv = (): void => {
    if (loaded) return
    loaded = true
    protectedNames = new Set(Object.keys(process.env))

    const cwd = process.cwd()
    const explicit = process.env.YGKIT_ENV_FILE
    const candidates = [
        ...(explicit ? [isAbsolute(explicit) ? explicit : join(cwd, explicit)] : []),
        join(cwd, '.env'),
        join(cwd, '.env.server'),
        join(cwd, '.env.production')
    ]
    for (const path of candidates) parseEnvFile(path)
}
