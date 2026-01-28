export function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
}

export function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {}
        }
        current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
}

export function getAllFieldPaths(data: any, prefix = ''): string[] {
    const paths: string[] = []
    for (const key in data) {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
            paths.push(...getAllFieldPaths(data[key], path))
        } else {
            paths.push(path)
        }
    }
    return paths
}
