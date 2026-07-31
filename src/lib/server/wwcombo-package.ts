import { createHash } from 'node:crypto'
import {
    MAX_WWCOMBO_PACKAGE_BYTES,
    getWwcomboChartDuration,
    getWwcomboChartTeam,
    parseWwcomboChartPackage
} from '$lib/workshop/wwcombo-package'
import type { WwcomboChartPackage } from '$lib/workshop/types'

export interface ValidatedPracticeChart {
    package: WwcomboChartPackage
    serialized: string
    checksum: string
    title: string
    team: string[]
    actionCount: number
    durationMs: number
}

export const validatePracticeChartForStorage = (value: unknown): ValidatedPracticeChart => {
    const chartPackage = parseWwcomboChartPackage(value)
    const serialized = JSON.stringify(chartPackage)
    if (Buffer.byteLength(serialized, 'utf8') > MAX_WWCOMBO_PACKAGE_BYTES) throw new Error('练轴文件不能超过 1 MB')

    return {
        package: chartPackage,
        serialized,
        checksum: createHash('sha256').update(serialized, 'utf8').digest('hex'),
        title: chartPackage.chart.title.trim().slice(0, 120),
        team: getWwcomboChartTeam(chartPackage.chart),
        actionCount: chartPackage.chart.steps.length,
        durationMs: getWwcomboChartDuration(chartPackage.chart)
    }
}
