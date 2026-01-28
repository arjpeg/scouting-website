import type { Submission } from '../types'

export function normalizeSubmission(snapshot: any): Submission {
    const data = snapshot.data() as Submission
    const { id: _ignore, createdAt, ...rest } = data
    const createdAtMs =
        typeof createdAt === 'number'
            ? createdAt
            : (createdAt as any)?.toMillis
                ? (createdAt as any).toMillis()
                : Date.now()
    return { ...rest, id: snapshot.id, createdAt: createdAtMs } as Submission
}
