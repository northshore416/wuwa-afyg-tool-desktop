export type ParsedTextAxisAction = { key: string; label: string }
export type ParsedTextAxisEntry = ParsedTextAxisAction & { trackIndex: number }

type RoleAlias = { alias: string; trackIndex: number; name: string }
type ActionMatch = { key: string; label: string; length: number; kind?: 'intro' | 'outro' }

const TEXT_AXIS_SPECIAL_LABELS: Record<string, string> = {
    Intro: '变奏',
    Outro: '延奏'
}

const SEPARATOR_RE = /[\s\u3000,，、;；|/\\:：.。~～_+]+/
const PASSIVE_ANNOTATION_RE = /[0-9０-９]/

export function getOpBlockKeyLabel(key: string): string {
    return TEXT_AXIS_SPECIAL_LABELS[key] ?? key
}

export function getOpBlockFallbackLabel(key: string): string {
    if (key === 'MouseLeft') return 'A'
    if (key === 'MouseRight') return '闪'
    if (key === 'SpaceBar') return '跳'
    return getOpBlockKeyLabel(key)
}

function isSeparator(ch: string) {
    return SEPARATOR_RE.test(ch) || ch === '-'
}

function matchAction(text: string, index: number): ActionMatch | null {
    const rest = text.slice(index)
    const lower = rest.toLowerCase()

    if (lower.startsWith('intro')) return { key: 'Intro', label: '变奏', length: 5, kind: 'intro' }
    if (lower.startsWith('outro')) return { key: 'Outro', label: '延奏', length: 5, kind: 'outro' }
    if (rest.startsWith('变奏')) return { key: 'Intro', label: '变奏', length: 2, kind: 'intro' }
    if (rest.startsWith('延奏')) return { key: 'Outro', label: '延奏', length: 2, kind: 'outro' }
    if (rest.startsWith('闪避') || rest.startsWith('右键')) return { key: 'MouseRight', label: '闪避', length: 2 }
    if (rest.startsWith('空格')) return { key: 'SpaceBar', label: '跳', length: 2 }
    if (rest.startsWith('处决')) return { key: 'F', label: '处决', length: 2 }
    if (rest.startsWith('钩锁')) return { key: 'T', label: '钩锁', length: 2 }

    const ch = text[index]
    if (/[aeqrz]/i.test(ch)) {
        const key = ch.toUpperCase()
        return key === 'A' ? { key: 'MouseLeft', label: '左键', length: 1 } : { key, label: key, length: 1 }
    }
    if (ch === '变') return { key: 'Intro', label: '变奏', length: 1, kind: 'intro' }
    if (ch === '延') return { key: 'Outro', label: '延奏', length: 1, kind: 'outro' }
    if (ch === '闪') return { key: 'MouseRight', label: '闪避', length: 1 }
    if (ch === '跳') return { key: 'SpaceBar', label: '跳', length: 1 }
    if (ch === '处') return { key: 'F', label: '处决', length: 1 }
    if (ch === '钩') return { key: 'T', label: '钩锁', length: 1 }
    return null
}

function buildRoleAliases(teamNames: string[]) {
    const warnings: string[] = []
    const aliases: RoleAlias[] = []
    const charOwners = new Map<string, Set<number>>()

    teamNames.forEach((name, trackIndex) => {
        aliases.push({ alias: name, trackIndex, name })
        for (const ch of [...name]) {
            if (isSeparator(ch)) continue
            const owners = charOwners.get(ch) ?? new Set<number>()
            owners.add(trackIndex)
            charOwners.set(ch, owners)
        }
    })

    for (const [ch, owners] of charOwners) {
        if (owners.size === 1) {
            const trackIndex = [...owners][0]
            aliases.push({ alias: ch, trackIndex, name: teamNames[trackIndex] })
        } else {
            warnings.push(`缩写「${ch}」对应多个角色，已忽略，请使用全名`)
        }
    }

    aliases.sort((a, b) => b.alias.length - a.alias.length)
    return { aliases, warnings }
}

function matchRole(text: string, index: number, aliases: RoleAlias[]) {
    return aliases.find((alias) => text.startsWith(alias.alias, index)) ?? null
}

export function parseTextAxisActions(raw: string): { actions: ParsedTextAxisAction[]; warnings: string[] } {
    const actions: ParsedTextAxisAction[] = []
    const warnings: string[] = []
    const text = raw.trim()
    let i = 0

    const skipSeparators = () => {
        while (i < text.length && isSeparator(text[i])) i++
    }

    while (i < text.length) {
        skipSeparators()
        if (i >= text.length) break

        const action = matchAction(text, i)
        if (action) {
            actions.push({ key: action.key, label: action.label })
            i += action.length
            continue
        }

        if (PASSIVE_ANNOTATION_RE.test(text[i])) {
            i++
            continue
        }

        const token = text[i]?.trim()
        if (token) warnings.push(token)
        i++
    }

    return { actions, warnings }
}

export function parseTextAxisTimeline(
    raw: string,
    teamNames: string[]
): { entries: ParsedTextAxisEntry[]; warnings: string[] } {
    const entries: ParsedTextAxisEntry[] = []
    const warnings: string[] = []
    const { aliases, warnings: aliasWarnings } = buildRoleAliases(teamNames)
    warnings.push(...aliasWarnings)

    const sourceLines = raw.split(/\r?\n/)
    for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex++) {
        const text = sourceLines[lineIndex].trim()
        if (!text) continue

        let i = 0
        let currentTrack: number | null = null
        let lastActionTrack: number | null = null
        let pendingIntro = false
        let lineHadEntries = false

        const warn = (message: string) => warnings.push(`第 ${lineIndex + 1} 行：${message}`)
        const pushEntry = (trackIndex: number, action: ParsedTextAxisAction) => {
            entries.push({ ...action, trackIndex })
            currentTrack = trackIndex
            lastActionTrack = trackIndex
            lineHadEntries = true
        }
        const skipSeparators = () => {
            while (i < text.length && isSeparator(text[i])) i++
        }

        while (i < text.length) {
            skipSeparators()
            if (i >= text.length) break

            const action = matchAction(text, i)
            if (action?.kind === 'intro') {
                i += action.length
                skipSeparators()
                const nextRole = matchRole(text, i, aliases)
                if (nextRole) {
                    currentTrack = nextRole.trackIndex
                    i += nextRole.alias.length
                    pushEntry(nextRole.trackIndex, { key: action.key, label: action.label })
                } else if (currentTrack !== null) {
                    pushEntry(currentTrack, { key: action.key, label: action.label })
                } else {
                    pendingIntro = true
                }
                continue
            }

            if (action?.kind === 'outro') {
                i += action.length
                const targetTrack = lastActionTrack ?? currentTrack
                if (targetTrack !== null) {
                    pushEntry(targetTrack, { key: action.key, label: action.label })
                } else {
                    warn('延奏前没有可绑定的角色')
                }
                continue
            }

            const role = matchRole(text, i, aliases)
            if (role) {
                currentTrack = role.trackIndex
                i += role.alias.length
                skipSeparators()
                if (pendingIntro) {
                    pushEntry(role.trackIndex, { key: 'Intro', label: '变奏' })
                    pendingIntro = false
                }
                continue
            }

            if (action) {
                if (currentTrack === null) {
                    warn(`动作「${action.label}」前未识别角色`)
                } else {
                    pushEntry(currentTrack, { key: action.key, label: action.label })
                }
                i += action.length
                continue
            }

            if (PASSIVE_ANNOTATION_RE.test(text[i])) {
                i++
                continue
            }

            const token = text[i]?.trim()
            if (token) warn(`未识别片段「${token}」`)
            i++
        }

        if (pendingIntro) warn('变奏后没有可绑定的角色')
        if (!lineHadEntries) warn('未识别角色')
    }

    return { entries, warnings }
}
