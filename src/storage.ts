import type { Submission } from './types'

const KEY = 'pending-submissions'

export function loadPendingSubmissions(): Submission[] {
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? (JSON.parse(raw) as Submission[]) : []
    } catch (err) {
        console.error('Failed to read pending submissions', err)
        return []
    }
}

function persist(submissions: Submission[]) {
    localStorage.setItem(KEY, JSON.stringify(submissions))
}

export function addPendingSubmission(entry: Submission) {
    const existing = loadPendingSubmissions()
    persist([entry, ...existing])
}

export function removePendingSubmission(id: string) {
    const filtered = loadPendingSubmissions().filter((item) => item.id !== id)
    persist(filtered)
}

export function clearPendingSubmissions() {
    localStorage.removeItem(KEY)
}
