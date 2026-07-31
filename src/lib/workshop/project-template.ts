import { defaultConfig } from '$lib/components/page/home/config/config.consts'
import type { ConfigState } from '$lib/components/page/home/config/config.types'
import type { CharSlot, Project } from '$lib/data/types'

const emptyEchoes = (): CharSlot['echoes'] => [
    { name: null, cost: 0 },
    { name: null, cost: 0 },
    { name: null, cost: 0 },
    { name: null, cost: 0 },
    { name: null, cost: 0 }
]

const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const emptyEchoConfig = (): ConfigState['characters'][number]['echoes'] => [
    { cost: 0, mainStat: null, secondMainStat: null, substats: [] },
    { cost: 0, mainStat: null, secondMainStat: null, substats: [] },
    { cost: 0, mainStat: null, secondMainStat: null, substats: [] },
    { cost: 0, mainStat: null, secondMainStat: null, substats: [] },
    { cost: 0, mainStat: null, secondMainStat: null, substats: [] }
]

const sanitizeTeam = (team: Project['team']): Project['team'] =>
    team.map((slot) => ({
        character: typeof slot?.character === 'string' ? slot.character : null,
        weapon: typeof slot?.weapon === 'string' ? slot.weapon : null,
        triggerSets: Array.isArray(slot?.triggerSets)
            ? slot.triggerSets
                  .filter((set) => typeof set?.name === 'string' && Number.isFinite(set?.pieces))
                  .map((set) => ({ name: set.name, pieces: set.pieces }))
            : [],
        echoes: emptyEchoes()
    })) as Project['team']

const sanitizeConfig = (value: unknown): ConfigState => {
    const fallback = defaultConfig()
    if (!value || typeof value !== 'object') return fallback

    const source = value as Partial<ConfigState>
    return {
        characters: [{ echoes: emptyEchoConfig() }, { echoes: emptyEchoConfig() }, { echoes: emptyEchoConfig() }],
        enemy:
            source.enemy && typeof source.enemy === 'object'
                ? { ...fallback.enemy, ...toPlain(source.enemy) }
                : fallback.enemy
    }
}

export const sanitizeWorkshopProject = (input: unknown): Project => {
    if (!input || typeof input !== 'object') throw new Error('项目数据无效')

    const source = toPlain(input) as Partial<Project>
    if (!Array.isArray(source.team) || source.team.length !== 3) throw new Error('队伍数据无效')
    if (!source.phases || typeof source.phases !== 'object') throw new Error('项目阶段数据无效')

    const phase = (key: keyof Project['phases']) => ({
        locked: source.phases?.[key]?.locked === true,
        data: source.phases?.[key]?.data ?? null
    })
    const config = phase('config')

    return {
        id: typeof source.id === 'string' ? source.id : crypto.randomUUID(),
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 80) : '创意工坊方案',
        createdAt: typeof source.createdAt === 'number' ? source.createdAt : Date.now(),
        team: sanitizeTeam(source.team as Project['team']),
        customSkillHits:
            source.customSkillHits && typeof source.customSkillHits === 'object' ? toPlain(source.customSkillHits) : {},
        lockedTeamKey: typeof source.lockedTeamKey === 'string' ? source.lockedTeamKey : undefined,
        lockedTeamNames: Array.isArray(source.lockedTeamNames)
            ? source.lockedTeamNames.filter((name): name is string => typeof name === 'string')
            : undefined,
        phases: {
            team: phase('team'),
            timeline: phase('timeline'),
            calculation: phase('calculation'),
            config: {
                locked: false,
                data: sanitizeConfig(config.data)
            }
        }
    }
}

export const prepareWorkshopImport = (project: Project, title: string): Project => ({
    ...toPlain(project),
    id: crypto.randomUUID(),
    name: title.trim() || project.name,
    createdAt: Date.now(),
    resultAnalysis: undefined
})
