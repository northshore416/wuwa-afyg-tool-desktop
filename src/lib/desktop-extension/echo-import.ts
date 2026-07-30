import { MAIN_STAT_POOL, SECOND_MAIN_STAT, SUBSTAT_OPTIONS } from '$lib/consts/stat-data'
import { defaultConfig } from '$lib/components/page/home/config/config.consts'
import type { ConfigState, EchoSlotConfig } from '$lib/components/page/home/config/config.types'
import type { CharSlot } from '$lib/data/types'
import type { EchoStat } from '$lib/types/game-data'

type ImportStatInput =
    | string
    | {
          type?: string
          name?: string
          label?: string
          value?: number | string
          unit?: string
      }

export interface EchoImportEcho {
    name?: string
    echoName?: string
    cost?: number | string
    mainStat?: ImportStatInput | null
    substats?: ImportStatInput[]
}

export interface EchoImportCharacter {
    character?: string
    name?: string
    role?: string
    echoes?: EchoImportEcho[]
}

export interface EchoImportPayload {
    version?: 1
    source?: string
    characters?: EchoImportCharacter[]
}

export interface EchoImportApplyResult {
    team: [CharSlot, CharSlot, CharSlot]
    config: ConfigState
    applied: number
    warnings: string[]
}

export interface EchoImportBridgeResult {
    ok: boolean
    applied: number
    warnings: string[]
    message: string
}

export interface EchoImportBridge {
    version: 1
    getActiveTeam: () => (string | null)[]
    importEchoes: (payload: EchoImportPayload) => Promise<EchoImportBridgeResult>
}

const PUNCT_RE = /[\s,，、。；;:：/\\|_\-—（）()【】[\]{}"'“”‘’]+/g

const STAT_ALIASES: Record<string, string> = {
    暴击: '暴击率',
    暴率: '暴击率',
    暴击率: '暴击率',
    爆伤: '暴击伤害',
    暴击伤害: '暴击伤害',
    攻击百分比: '攻击%',
    攻击力百分比: '攻击%',
    大攻击: '攻击%',
    攻击力: '攻击',
    攻击: '攻击',
    小攻击: '攻击',
    生命百分比: '生命%',
    生命值百分比: '生命%',
    大生命: '生命%',
    生命: '生命',
    小生命: '生命',
    防御百分比: '防御%',
    防御力百分比: '防御%',
    大防御: '防御%',
    防御力: '防御',
    防御: '防御',
    小防御: '防御',
    治疗: '治疗加成',
    治疗加成: '治疗加成',
    共鸣效率: '共鸣效率',
    充能: '共鸣效率',
    普攻: '普攻伤害加成',
    普攻伤害: '普攻伤害加成',
    普攻伤害加成: '普攻伤害加成',
    重击: '重击伤害加成',
    重击伤害: '重击伤害加成',
    重击伤害加成: '重击伤害加成',
    共鸣技能: '共鸣技能伤害加成',
    共鸣技能伤害: '共鸣技能伤害加成',
    共鸣技能伤害加成: '共鸣技能伤害加成',
    共鸣解放: '共鸣解放伤害加成',
    共鸣解放伤害: '共鸣解放伤害加成',
    共鸣解放伤害加成: '共鸣解放伤害加成',
    冷凝: '冷凝伤害加成',
    热熔: '热熔伤害加成',
    导电: '导电伤害加成',
    气动: '气动伤害加成',
    衍射: '衍射伤害加成',
    湮灭: '湮灭伤害加成'
}

function cleanKey(value: string): string {
    return value.replace(PUNCT_RE, '').replace(/%/g, '百分比').toLowerCase()
}

function statLabelMap(): Map<string, string> {
    const map = new Map<string, string>()
    const labels = new Set<string>()

    for (const pool of Object.values(MAIN_STAT_POOL)) {
        for (const option of pool) labels.add(option.label)
    }
    for (const option of SUBSTAT_OPTIONS) labels.add(option.label)
    for (const option of Object.values(SECOND_MAIN_STAT)) labels.add(option.label)

    for (const label of labels) {
        map.set(cleanKey(label), label)
        map.set(cleanKey(label.replace('伤害加成', '')), label)
    }
    for (const [alias, label] of Object.entries(STAT_ALIASES)) {
        map.set(cleanKey(alias), label)
    }
    return map
}

const STAT_LABELS = statLabelMap()

function cloneTeam(team: [CharSlot, CharSlot, CharSlot]): [CharSlot, CharSlot, CharSlot] {
    return JSON.parse(JSON.stringify(team))
}

function cloneConfig(config: ConfigState | null): ConfigState {
    return JSON.parse(JSON.stringify(config ?? defaultConfig()))
}

function parseCost(value: EchoImportEcho['cost'], fallback: number): number {
    const num = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : Number(value)
    return num === 1 || num === 3 || num === 4 ? num : fallback
}

function parseValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string') return null
    const num = Number(value.replace(/%/g, '').trim())
    return Number.isFinite(num) ? num : null
}

function statName(input: ImportStatInput | null | undefined): string {
    if (!input) return ''
    if (typeof input === 'string') return input
    return input.type ?? input.name ?? input.label ?? ''
}

const percentageVariant = (label: string): string | null => {
    if (label === '攻击' || label === '生命' || label === '防御') return `${label}%`
    return null
}

const hasPercentageUnit = (input: ImportStatInput): boolean => {
    if (typeof input === 'string') return input.includes('%') || input.includes('百分比')
    return (
        input.unit?.includes('%') === true ||
        (typeof input.value === 'string' && input.value.includes('%')) ||
        statName(input).includes('%') ||
        statName(input).includes('百分比')
    )
}

const resolveStatLabel = (input: ImportStatInput, kind: 'main' | 'sub', cost: number | undefined): string | null => {
    const matched = STAT_LABELS.get(cleanKey(statName(input)))
    if (!matched) return null

    const percentage = percentageVariant(matched)
    if (!percentage) return matched
    if (hasPercentageUnit(input)) return percentage
    if (kind === 'main' && cost && MAIN_STAT_POOL[cost]?.some((option) => option.label === percentage)) {
        return percentage
    }
    return matched
}

function statUnit(label: string, kind: 'main' | 'sub', cost?: number): string {
    if (kind === 'sub') return SUBSTAT_OPTIONS.find((o) => o.label === label)?.unit ?? ''
    if (cost) return MAIN_STAT_POOL[cost]?.find((o) => o.label === label)?.unit ?? ''
    return ''
}

function normalizeStat(
    input: ImportStatInput | null | undefined,
    kind: 'main' | 'sub',
    warnings: string[],
    cost?: number
): EchoStat | null {
    if (!input) return null
    const rawName = statName(input)
    const label = resolveStatLabel(input, kind, cost)
    if (!label) {
        warnings.push(`未识别词条：${rawName}`)
        return null
    }

    const explicitValue = typeof input === 'string' ? null : parseValue(input.value)
    const fallback =
        kind === 'main'
            ? cost
                ? MAIN_STAT_POOL[cost]?.find((o) => o.label === label)?.maxValue
                : undefined
            : SUBSTAT_OPTIONS.find((o) => o.label === label)?.tiers.at(-1)

    const value = explicitValue ?? fallback ?? 0
    const unit = typeof input === 'string' ? statUnit(label, kind, cost) : input.unit || statUnit(label, kind, cost)
    return { type: label, value, unit }
}

function findCharacterIndex(item: EchoImportCharacter, team: [CharSlot, CharSlot, CharSlot], fallback: number): number {
    const rawName = item.character ?? item.name ?? item.role
    if (!rawName) return fallback
    const key = cleanKey(rawName)
    const exact = team.findIndex((slot) => slot.character && cleanKey(slot.character) === key)
    if (exact !== -1) return exact
    const partial = team.findIndex((slot) => {
        if (!slot.character) return false
        const teamKey = cleanKey(slot.character)
        return teamKey.includes(key) || key.includes(teamKey)
    })
    return partial
}

function normalizeEchoSlot(
    echo: EchoImportEcho,
    previous: EchoSlotConfig,
    warnings: string[]
): { slot: EchoSlotConfig; name: string | null } {
    const cost = parseCost(echo.cost, previous.cost || 0)
    const second = SECOND_MAIN_STAT[cost] ? SECOND_MAIN_STAT[cost] : null
    const normalizedSubstats = (echo.substats ?? [])
        .map((item) => normalizeStat(item, 'sub', warnings))
        .filter((item): item is EchoStat => item !== null)
    const substats = [...new Map(normalizedSubstats.map((item) => [item.type, item])).values()].slice(0, 5)

    return {
        name: echo.name ?? echo.echoName ?? null,
        slot: {
            cost,
            mainStat: normalizeStat(echo.mainStat, 'main', warnings, cost) ?? previous.mainStat,
            secondMainStat: second ? { type: second.label, value: second.value, unit: second.unit } : null,
            substats
        }
    }
}

export function applyEchoImportPayload(
    payload: EchoImportPayload,
    team: [CharSlot, CharSlot, CharSlot],
    currentConfig: ConfigState | null
): EchoImportApplyResult {
    const warnings: string[] = []
    const nextTeam = cloneTeam(team)
    const nextConfig = cloneConfig(currentConfig)
    let applied = 0

    for (let order = 0; order < (payload.characters ?? []).length; order++) {
        const item = payload.characters?.[order]
        if (!item?.echoes?.length) continue
        const ci = findCharacterIndex(item, team, order)
        if (ci < 0 || ci > 2) {
            warnings.push(`无法匹配角色：${item.character ?? item.name ?? item.role ?? `第 ${order + 1} 个角色`}`)
            continue
        }

        for (let si = 0; si < Math.min(5, item.echoes.length); si++) {
            const previous = nextConfig.characters[ci].echoes[si]
            const normalized = normalizeEchoSlot(item.echoes[si], previous, warnings)
            nextConfig.characters[ci].echoes[si] = normalized.slot
            if (normalized.name) {
                nextTeam[ci].echoes[si] = {
                    name: normalized.name,
                    cost: normalized.slot.cost
                }
            } else {
                nextTeam[ci].echoes[si].cost = normalized.slot.cost
            }
            applied++
        }
    }

    return { team: nextTeam, config: nextConfig, applied, warnings }
}
