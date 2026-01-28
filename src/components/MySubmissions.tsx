import { useEffect, useMemo, useState } from 'preact/hooks'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import type { Submission } from '../types'
import { db } from '../firebase'

function normalizeSubmission(docSnap: any): Submission {
    const data = docSnap.data() as Submission
    const { id: _ignore, createdAt, ...rest } = data
    const createdAtMs =
        typeof createdAt === 'number' ? createdAt : (createdAt as any)?.toMillis ? (createdAt as any).toMillis() : Date.now()
    return { ...rest, id: docSnap.id, createdAt: createdAtMs } as Submission
}

export function MySubmissions({ userId, pendingLocal }: { userId: string; pendingLocal: Submission[] }) {
    const [remote, setRemote] = useState<Submission[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!userId) return
        setLoading(true)

        const q = query(collection(db, 'submissions'), where('createdBy', '==', userId))
        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const rows = snapshot.docs.map((d) => normalizeSubmission(d)).sort((a, b) => b.createdAt - a.createdAt)
                setRemote(rows)
                setLoading(false)
            },
            (err) => {
                console.error('Failed to load my submissions', err)
                setMessage('Could not load submissions')
                setLoading(false)
            },
        )

        return () => unsub()
    }, [userId])

    const combined = useMemo(() => {
        const remoteIds = new Set(remote.map((r) => r.id))
        const locals = pendingLocal.filter((p) => !remoteIds.has(p.id))
        return [...locals, ...remote].sort((a, b) => b.createdAt - a.createdAt)
    }, [pendingLocal, remote])

    return (
        <section class="panel">
            <header class="panel-header">
                <div>
                    <p class="eyebrow">Your work</p>
                    <h2>Your submissions</h2>
                    <p class="muted">Pending, approved, rejected, and local copies not yet synced.</p>
                </div>
            </header>

            {message && <p class="toast">{message}</p>}
            {loading && <p class="muted">Loading your submissions…</p>}

            {!loading && combined.length === 0 && <p>No submissions yet.</p>}

            {!loading && combined.length > 0 && (
                <div class="submissions-list">
                    {combined.map((submission) => {
                        const isLocalOnly = !remote.find((r) => r.id === submission.id)
                        return (
                            <div class="submission-card" key={submission.id}>
                                <div class="submission-header">
                                    <div>
                                        <div class="strong">
                                            Team {submission.data.teamNumber} ({submission.data.alliance.toUpperCase()})
                                        </div>
                                        <div class="muted small">{new Date(submission.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div class="badge">
                                        {isLocalOnly ? 'Local copy (unsynced)' : submission.status === 'approved' ? 'Approved' : submission.status === 'rejected' ? 'Rejected' : 'Pending'}
                                    </div>
                                </div>

                                <div class="submission-data">
                                    <div class="phase">
                                        <h4>Autonomous</h4>
                                        <div>Fuel Scored: {submission.data.auton.fuelScored}</div>
                                        <div>Fuel Missed: {submission.data.auton.fuelMissed}</div>
                                        <div>Climb: {submission.data.auton.climbLevel}</div>
                                    </div>

                                    <div class="phase">
                                        <h4>Teleop</h4>
                                        <div>Fuel Scored: {submission.data.teleop.fuelScored}</div>
                                        <div>Fuel Missed: {submission.data.teleop.fuelMissed}</div>
                                        <div>Climb: {submission.data.teleop.climbLevel}</div>
                                    </div>

                                    <div class="penalties">
                                        <div>Team Penalties: {submission.data.teamPenalties}</div>
                                        <div>Opponent Penalties: {submission.data.opponentPenalties}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
