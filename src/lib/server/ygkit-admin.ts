const values = (name: string): string[] =>
    (process.env[name] || '')
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean)

export const isYGKitAdmin = (subject: string): boolean => {
    if (values('YGKIT_ADMIN_SUBJECTS').includes(subject)) return true
    const qqId = subject.split(':').at(-1) || ''
    return values('YGKIT_ADMIN_QQ_IDS').includes(qqId)
}
