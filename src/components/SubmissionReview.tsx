import { useEffect, useState } from 'preact/hooks'
import { collection, updateDoc, doc, query, where, onSnapshot } from 'firebase/firestore'
import type { Submission } from '../types'
import { db } from '../firebase'
import { aggregateMatchStats } from '../aggregation'

export function SubmissionReview() {
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        setLoading(true)
        const q = query(collection(db, 'submissions'), where('status', '==', 'pending'))
        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const rows: Submission[] = snapshot.docs
                    .map((d) => {
                        const data = d.data() as Submission
                        const { id: _ignore, createdAt, ...rest } = data
                        const createdAtMs =
                            typeof createdAt === 'number'
                                ? createdAt
                                : (createdAt as any)?.toMillis
                                    ? (createdAt as any).toMillis()
                                    : Date.now()
                        return { ...rest, id: d.id, createdAt: createdAtMs } as Submission
                    })
                    .sort((a, b) => b.createdAt - a.createdAt)
                setSubmissions(rows)
                setLoading(false)
            },
            (err) => {
                console.error('Failed to load submissions', err)
                setMessage('Could not load submissions')
                setLoading(false)
            },
        )
        return () => unsub()
    }, [])

    async function approve(id: string) {
        setMessage(null)
        try {
            const submission = submissions.find((s) => s.id === id)
            if (!submission) return

            const now = Date.now()
            await updateDoc(doc(db, 'submissions', id), {
                status: 'approved',
                approvedAt: now,
            })

            // Trigger aggregation for this match
            await aggregateMatchStats(submission.matchId)

            setMessage('Submission approved and aggregated')
        } catch (err) {
            console.error('Failed to approve', err)
            const errorMsg = (err as any)?.message || 'Could not approve'
            setMessage(`Error: ${errorMsg}`)
        }
    }

    async function reject(id: string) {
        setMessage(null)
        try {
            await updateDoc(doc(db, 'submissions', id), { status: 'rejected' })
            setMessage('Submission rejected')
        } catch (err) {
            console.error('Failed to reject', err)
            const errorMsg = (err as any)?.message || 'Could not reject'
            setMessage(`Error: ${errorMsg}`)
        }
    }

    return (
        <section class="panel">
            <header class="panel-header">
                <div>
                    <p class="eyebrow">Moderator</p>
                    <h2>Pending submissions</h2>
                    <p class="muted">Review and approve scout data before it's recorded.</p>
                </div>
            </header>

            {message && <p class="toast">{message}</p>}
            {loading && <p class="muted">Loading submissions…</p>}

            {!loading && submissions.length === 0 && <p>No pending submissions.</p>}

            {!loading && submissions.length > 0 && (
                <div class="submissions-list">
                    {submissions.map((submission) => (
                        <div class="submission-card" key={submission.id}>
                            <div class="submission-header">
                                <div>
                                    <div class="strong">
                                        Team {submission.data.teamNumber} ({submission.data.alliance.toUpperCase()})
                                    </div>
                                    <div class="muted small">From: {submission.createdByName}</div>
                                    <div class="muted small">{new Date(submission.createdAt).toLocaleString()}</div>
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

                            <div class="actions">
                                <button class="ghost" onClick={() => reject(submission.id)}>
                                    Reject
                                </button>
                                <button onClick={() => approve(submission.id)}>Approve</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
