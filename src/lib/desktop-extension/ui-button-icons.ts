export const UI_BTN_ICON_CACHE_ENTITY = 'ui-btn-v3'

export function makeTextButtonIcon(label: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="7" width="54" height="50" rx="10" fill="#1f2937" stroke="#f8fafc" stroke-width="4"/><text x="32" y="40" text-anchor="middle" dominant-baseline="middle" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="32" font-weight="700" fill="#f8fafc">${label}</text></svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function augmentUiButtonIconPairs(keys: [string, string][]): [string, string][] {
    const result: [string, string][] = []
    for (const pair of keys) {
        result.push(pair)
        if (pair[0] === 'MouseRight') {
            result.push(['Intro', makeTextButtonIcon('\u53d8')])
            result.push(['Outro', makeTextButtonIcon('\u5ef6')])
        }
        if (pair[0] === 'R') {
            result.push(['Z', makeTextButtonIcon('Z')])
        }
    }
    return result
}
