import {
    AFYG_WORKSHOP_BUNDLE_TYPE,
    WWCOMBO_CHART_TYPE,
    type WwcomboChart,
    type WwcomboChartPackage
} from '$lib/workshop/types'

export const MAX_WWCOMBO_PACKAGE_BYTES = 1024 * 1024
export const MAX_WWCOMBO_STEPS = 2000
export const MAX_WWCOMBO_DURATION_MS = 10 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const requireString = (value: unknown, label: string, maxLength = 256): string => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(label + '不能为空')
    if (value.length > maxLength) throw new Error(label + '过长')
    return value
}

const requireFiniteNumber = (value: unknown, label: string, minimum = 0, maximum = MAX_WWCOMBO_DURATION_MS) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
        throw new Error(label + '无效')
    return value
}

const validateOptionalTiming = (value: unknown, label: string) => {
    if (value === undefined) return
    requireFiniteNumber(value, label)
}

const validateChart = (chartValue: unknown): WwcomboChart => {
    if (!isRecord(chartValue)) throw new Error('练轴文件缺少 chart 数据')
    requireString(chartValue.id, '连段 ID', 160)
    requireString(chartValue.title, '连段名称', 120)
    requireString(chartValue.startTriggerMoveId, '起始动作', 160)
    requireFiniteNumber(chartValue.version, '连段版本', 0, 1000)
    requireFiniteNumber(chartValue.createdAt, '创建时间', 0, Number.MAX_SAFE_INTEGER)
    requireFiniteNumber(chartValue.updatedAt, '更新时间', 0, Number.MAX_SAFE_INTEGER)
    if (!Array.isArray(chartValue.tags) || chartValue.tags.length > 32) throw new Error('连段标签无效')
    for (const tag of chartValue.tags) requireString(tag, '连段标签', 64)
    if (!Array.isArray(chartValue.steps) || chartValue.steps.length === 0) throw new Error('练轴文件中没有可练习动作')
    if (chartValue.steps.length > MAX_WWCOMBO_STEPS) throw new Error('练轴动作不能超过 ' + MAX_WWCOMBO_STEPS + ' 个')

    const stepIds = new Set<string>()
    for (const [index, stepValue] of chartValue.steps.entries()) {
        if (!isRecord(stepValue)) throw new Error('第 ' + (index + 1) + ' 个动作无效')
        const id = requireString(stepValue.id, '动作 ID', 160)
        if (stepIds.has(id)) throw new Error('练轴文件包含重复的动作 ID')
        stepIds.add(id)
        requireString(stepValue.moveId, '动作类型', 160)
        requireString(stepValue.label, '动作名称', 160)
        requireString(stepValue.color, '动作颜色', 64)
        if (stepValue.characterSlot !== undefined && ![1, 2, 3].includes(stepValue.characterSlot as number))
            throw new Error('动作角色槽位无效')
        if (stepValue.lane !== 'main' && stepValue.lane !== 'independent') throw new Error('动作轨道无效')
        if (typeof stepValue.independent !== 'boolean' || typeof stepValue.advancesStep !== 'boolean')
            throw new Error('动作属性无效')
        const startMin = requireFiniteNumber(stepValue.startMin, '动作开始时间')
        const startMax = requireFiniteNumber(stepValue.startMax, '动作结束时间')
        const durationMin = requireFiniteNumber(stepValue.durationMin, '动作最短时长')
        const durationMax = requireFiniteNumber(stepValue.durationMax, '动作最长时长')
        if (startMin > startMax || durationMin > durationMax) throw new Error('动作时间窗口无效')
        validateOptionalTiming(stepValue.preheatMs, '动作预热时间')
        validateOptionalTiming(stepValue.recoveryMs, '动作恢复时间')
        if (stepValue.note !== undefined && (typeof stepValue.note !== 'string' || stepValue.note.length > 500))
            throw new Error('动作备注无效')
        if (stepValue.samples !== undefined) {
            if (!Array.isArray(stepValue.samples) || stepValue.samples.length > 64) throw new Error('动作样本无效')
            for (const sample of stepValue.samples) {
                if (!isRecord(sample)) throw new Error('动作样本无效')
                requireString(sample.recordingId, '录制样本 ID', 160)
                requireFiniteNumber(sample.startTime, '样本开始时间')
                requireFiniteNumber(sample.duration, '样本时长')
            }
        }
    }

    if (chartValue.timelineDurationMs !== undefined) requireFiniteNumber(chartValue.timelineDurationMs, '时间轴总时长')
    if (chartValue.periods !== undefined) {
        if (!Array.isArray(chartValue.periods) || chartValue.periods.length > 500) throw new Error('时间轴时段无效')
        for (const period of chartValue.periods) {
            if (!isRecord(period)) throw new Error('时间轴时段无效')
            requireString(period.id, '时段 ID', 160)
            requireString(period.kind, '时段类型', 80)
            requireString(period.label, '时段名称', 160)
            const startMs = requireFiniteNumber(period.startMs, '时段开始时间')
            const endMs = requireFiniteNumber(period.endMs, '时段结束时间')
            if (startMs > endMs) throw new Error('时段时间范围无效')
        }
    }

    return chartValue as unknown as WwcomboChart
}

export const parseWwcomboChartPackage = (value: unknown): WwcomboChartPackage => {
    if (!isRecord(value) || value.type !== WWCOMBO_CHART_TYPE) throw new Error('请选择 wwcombo 导出的练轴 JSON 文件')
    if (!Number.isInteger(value.version) || (value.version as number) < 1 || (value.version as number) > 3)
        throw new Error('暂不支持这个练轴文件版本')
    validateChart(value.chart)

    if (value.contentLabels !== undefined) {
        if (!isRecord(value.contentLabels) || Object.keys(value.contentLabels).length > MAX_WWCOMBO_STEPS)
            throw new Error('动作文字数据无效')
        for (const [stepId, label] of Object.entries(value.contentLabels)) {
            requireString(stepId, '动作文字 ID', 160)
            requireString(label, '动作文字', 160)
        }
    }
    if (value.moves !== undefined && (!Array.isArray(value.moves) || value.moves.length > 512))
        throw new Error('动作定义数据无效')
    if (value.bindings !== undefined && (!Array.isArray(value.bindings) || value.bindings.length > 512))
        throw new Error('按键绑定数据无效')

    const normalized = JSON.parse(JSON.stringify(value)) as WwcomboChartPackage
    normalized.chart.tags = normalized.chart.tags || []
    for (const step of normalized.chart.steps) step.samples = Array.isArray(step.samples) ? step.samples : []
    return normalized
}

export const extractWwcomboChartPackages = (value: unknown): WwcomboChartPackage[] => {
    if (isRecord(value) && value.type === WWCOMBO_CHART_TYPE) return [parseWwcomboChartPackage(value)]
    if (isRecord(value) && value.type === AFYG_WORKSHOP_BUNDLE_TYPE) {
        if (!Array.isArray(value.practiceCharts)) throw new Error('工坊组合预设缺少练轴数据')
        const packages = value.practiceCharts.flatMap((entry) => {
            if (!isRecord(entry) || entry.package === undefined) return []
            return [parseWwcomboChartPackage(entry.package)]
        })
        if (packages.length === 0) throw new Error('这个工坊组合预设没有练轴文件')
        return packages
    }
    throw new Error('文件不是可识别的 wwcombo 练轴预设')
}

export const getWwcomboChartTeam = (chart: WwcomboChart): string[] => {
    const values = Array.isArray(chart.community?.characters)
        ? chart.community.characters
        : chart.character
          ? [chart.character]
          : []
    return [...new Set(values.map((name) => name.trim()).filter(Boolean))].slice(0, 3)
}

export const getWwcomboChartDuration = (chart: WwcomboChart): number => {
    const stepEnd = chart.steps.reduce(
        (maximum, step) => Math.max(maximum, step.startMax + step.durationMax + (step.recoveryMs || 0)),
        0
    )
    const periodEnd = (chart.periods || []).reduce((maximum, period) => Math.max(maximum, period.endMs), 0)
    return Math.round(Math.max(chart.timelineDurationMs || 0, stepEnd, periodEnd))
}

export const formatWwcomboDuration = (durationMs: number): string => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return minutes > 0 ? minutes + ' 分 ' + seconds + ' 秒' : seconds + ' 秒'
}
