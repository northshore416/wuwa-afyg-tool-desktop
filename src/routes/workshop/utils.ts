export const formatWorkshopDate = (seconds: number): string =>
    new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(seconds * 1000))

export const responseMessage = async (response: Response): Promise<string> => {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        const body = (await response.json()) as { message?: string }
        return body.message || `请求失败（HTTP ${response.status}）`
    }
    return `请求失败（HTTP ${response.status}）`
}
