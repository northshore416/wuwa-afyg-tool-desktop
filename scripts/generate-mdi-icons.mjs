import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import mdi from '@iconify-json/mdi/icons.json' with { type: 'json' }

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))
const output = fileURLToPath(new URL('../src/lib/utils/mdi-icons.ts', import.meta.url))
const sourceExtensions = new Set(['.svelte', '.ts'])
const iconPattern = /mdi:([a-z0-9-]+)/g

const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return walk(path)
        return sourceExtensions.has(extname(entry.name)) ? [path] : []
    })

const names = new Set()
for (const file of walk(sourceRoot)) {
    for (const match of readFileSync(file, 'utf8').matchAll(iconPattern)) names.add(match[1])
}

const icons = Object.fromEntries(
    [...names]
        .sort()
        .map((name) => [name, mdi.icons[name]])
        .filter(([, icon]) => Boolean(icon))
)
const missing = [...names].filter((name) => !mdi.icons[name])
if (missing.length) throw new Error(`Missing MDI icons: ${missing.join(', ')}`)

const source = `const mdiIcons = ${JSON.stringify(
    {
        prefix: mdi.prefix,
        width: mdi.width,
        height: mdi.height,
        icons
    },
    null,
    4
)} as const\n\nexport default mdiIcons\n`

writeFileSync(output, source)
console.log(`Generated ${Object.keys(icons).length} MDI icons in ${relative(root, output)}`)
