import { useEffect, useMemo, useState } from 'preact/hooks'
import { addDoc, collection, getDocs, updateDoc, doc, onSnapshot, deleteDoc } from 'firebase/firestore'
import type { Match, Submission } from '../types'
import { db } from '../firebase'
import { normalizeSubmission } from '../utils/submission'

export function ModeratorDashboard({ users }: { users: any[] }) {
    const [matches, setMatches] = useState<Match[]>([])
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [formData, setFormData] = useState({
        label: '',
        start: '',
        redTeams: '',
        blueTeams: '',
    })

    useEffect(() => {
        loadMatches()
    }, [])

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'submissions'),
            (snapshot) => {
                const rows = snapshot.docs.map((d) => normalizeSubmission(d))
                setSubmissions(rows)
            },
            (err) => {
                console.error('Failed to load submissions', err)
            },
        )
        return () => unsub()
    }, [])

    const matchStats = useMemo(() => {
        const stats: Record<string, { pending: number; approved: number; rejected: number }> = {}
        for (const sub of submissions) {
            const bucket = stats[sub.matchId] || { pending: 0, approved: 0, rejected: 0 }
            if (sub.status === 'pending') bucket.pending += 1
            if (sub.status === 'approved') bucket.approved += 1
            if (sub.status === 'rejected') bucket.rejected += 1
            stats[sub.matchId] = bucket
        }
        return stats
    }, [submissions])

    const matchDetailedStats = useMemo(() => {
        const stats: Record<string, {
            totalFuelScored: number
            totalFuelMissed: number
            totalTeamPenalties: number
            totalOpponentPenalties: number
            climbLevels: Record<string, number>
            submissionCount: number
        }> = {}

        const approvedSubmissions = submissions.filter(s => s.status === 'approved')

        for (const sub of approvedSubmissions) {
            if (!stats[sub.matchId]) {
                stats[sub.matchId] = {
                    totalFuelScored: 0,
                    totalFuelMissed: 0,
                    totalTeamPenalties: 0,
                    totalOpponentPenalties: 0,
                    climbLevels: {},
                    submissionCount: 0
                }
            }

            const s = stats[sub.matchId]
            s.totalFuelScored += sub.data.auton.fuelScored + sub.data.teleop.fuelScored
            s.totalFuelMissed += sub.data.auton.fuelMissed + sub.data.teleop.fuelMissed
            s.totalTeamPenalties += sub.data.teamPenalties
            s.totalOpponentPenalties += sub.data.opponentPenalties

            const autonClimb = sub.data.auton.climbLevel
            const teleopClimb = sub.data.teleop.climbLevel
            s.climbLevels[autonClimb] = (s.climbLevels[autonClimb] || 0) + 1
            s.climbLevels[teleopClimb] = (s.climbLevels[teleopClimb] || 0) + 1

            s.submissionCount += 1
        }

        return stats
    }, [submissions])

    async function loadMatches() {
        setLoading(true)
        try {
            const snapshot = await getDocs(collection(db, 'matches'))
            const rows: Match[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Match))
            setMatches(rows.sort((a, b) => a.start - b.start))
        } catch (err) {
            console.error('Failed to load matches', err)
            setMessage('Could not load matches')
        } finally {
            setLoading(false)
        }
    }

    async function handleCreateMatch(event: Event) {
        event.preventDefault()
        setMessage(null)

        if (!formData.label || !formData.start || !formData.redTeams || !formData.blueTeams) {
            setMessage('Fill all fields')
            return
        }

        try {
            const startTime = new Date(formData.start).getTime()
            const redTeams = formData.redTeams.split(',').map((t) => t.trim())
            const blueTeams = formData.blueTeams.split(',').map((t) => t.trim())

            const newMatch: Omit<Match, 'id'> = {
                label: formData.label,
                start: startTime,
                red: redTeams,
                blue: blueTeams,
            }

            const docRef = await addDoc(collection(db, 'matches'), newMatch)
            setMatches((prev) => [...prev, { id: docRef.id, ...newMatch }].sort((a, b) => a.start - b.start))
            setFormData({ label: '', start: '', redTeams: '', blueTeams: '' })
            setFormOpen(false)
            setMessage('Match created')
        } catch (err) {
            console.error('Failed to create match', err)
            setMessage('Could not create match')
        }
    }

    async function randomAssignScouts(matchId: string) {
        setMessage(null)
        try {
            const match = matches.find((m) => m.id === matchId)
            if (!match) {
                setMessage('Match not found')
                return
            }

            // Get unassigned scouts (only users with 'scout' role)
            const unassignedScouts = users.filter((u) => u.role === 'scout' && !u.assignedMatchId)
            if (unassignedScouts.length === 0) {
                setMessage('No unassigned scouts')
                return
            }

            // Build list of available team slots (not yet assigned)
            const assignedTeams = new Set(
                users
                    .filter((u) => u.assignedMatchId === matchId && u.assignedTeamNumber)
                    .map((u) => `${u.assignedAlliance}-${u.assignedTeamNumber}`),
            )

            const availableSlots: { alliance: 'red' | 'blue'; team: string }[] = []
            for (const team of match.red) {
                if (!assignedTeams.has(`red-${team}`)) {
                    availableSlots.push({ alliance: 'red', team })
                }
            }
            for (const team of match.blue) {
                if (!assignedTeams.has(`blue-${team}`)) {
                    availableSlots.push({ alliance: 'blue', team })
                }
            }

            if (availableSlots.length === 0) {
                setMessage('All team slots are assigned')
                return
            }

            // Shuffle scouts and slots
            const shuffledScouts = [...unassignedScouts].sort(() => Math.random() - 0.5)
            const shuffledSlots = [...availableSlots].sort(() => Math.random() - 0.5)

            // Assign scouts to available slots
            let assignedCount = 0
            for (let i = 0; i < shuffledScouts.length && i < shuffledSlots.length; i++) {
                const scout = shuffledScouts[i]
                const slot = shuffledSlots[i]
                await updateDoc(doc(db, 'users', scout.uid), {
                    assignedMatchId: matchId,
                    assignedAlliance: slot.alliance,
                    assignedTeamNumber: slot.team,
                })
                assignedCount++
            }

            setMessage(`Assigned ${assignedCount} scout${assignedCount !== 1 ? 's' : ''} to available slots`)
        } catch (err) {
            console.error('Failed to assign scouts', err)
            setMessage('Could not assign scouts')
        }
    }

    async function unassignScout(uid: string, scoutName: string) {
        setMessage(null)
        try {
            await updateDoc(doc(db, 'users', uid), {
                assignedMatchId: null,
                assignedAlliance: null,
                assignedTeamNumber: null,
            })
            setMessage(`Unassigned ${scoutName}`)
        } catch (err) {
            console.error('Failed to unassign scout', err)
            setMessage('Could not unassign scout')
        }
    }

    async function handleDeleteMatch(matchId: string, matchLabel: string) {
        setMessage(null)

        // Confirm deletion
        if (!confirm(`Are you sure you want to delete "${matchLabel}"? This will also unassign all scouts from this match.`)) {
            return
        }

        try {
            // Unassign all scouts from this match
            const assignedScouts = users.filter((u) => u.assignedMatchId === matchId)
            for (const scout of assignedScouts) {
                await updateDoc(doc(db, 'users', scout.uid), {
                    assignedMatchId: null,
                    assignedAlliance: null,
                    assignedTeamNumber: null,
                })
            }

            // Delete the match document
            await deleteDoc(doc(db, 'matches', matchId))

            // Update local state
            setMatches((prev) => prev.filter((m) => m.id !== matchId))
            setMessage(`Match "${matchLabel}" deleted`)
        } catch (err) {
            console.error('Failed to delete match', err)
            setMessage('Could not delete match')
        }
    }

    function getAssignedScouts(matchId: string) {
        return users.filter((u) => u.role === 'scout' && u.assignedMatchId === matchId)
    }

    return (
        <section class="panel">
            <header class="panel-header">
                <div>
                    <p class="eyebrow">Moderator</p>
                    <h2>Match management</h2>
                    <p class="muted">Create matches, set up alliances, and assign scouts.</p>
                </div>
                <button onClick={() => setFormOpen(!formOpen)}>{formOpen ? 'Cancel' : 'Create match'}</button>
            </header>

            {message && <p class="toast">{message}</p>}

            {formOpen && (
                <form class="grid" onSubmit={handleCreateMatch} style={{ marginBottom: '16px' }}>
                    <label class="stack">
                        <span class="label">Match label</span>
                        <input
                            type="text"
                            value={formData.label}
                            onInput={(e) => setFormData({ ...formData, label: (e.target as HTMLInputElement).value })}
                            placeholder="e.g. Qualifier 1"
                            required
                        />
                    </label>

                    <label class="stack">
                        <span class="label">Start time</span>
                        <input
                            type="datetime-local"
                            value={formData.start}
                            onInput={(e) => setFormData({ ...formData, start: (e.target as HTMLInputElement).value })}
                            required
                        />
                    </label>

                    <label class="stack">
                        <span class="label">Red alliance teams (comma-separated)</span>
                        <input
                            type="text"
                            value={formData.redTeams}
                            onInput={(e) => setFormData({ ...formData, redTeams: (e.target as HTMLInputElement).value })}
                            placeholder="e.g. 1234, 5678, 9012"
                            required
                        />
                    </label>

                    <label class="stack">
                        <span class="label">Blue alliance teams (comma-separated)</span>
                        <input
                            type="text"
                            value={formData.blueTeams}
                            onInput={(e) => setFormData({ ...formData, blueTeams: (e.target as HTMLInputElement).value })}
                            placeholder="e.g. 3456, 7890, 2468"
                            required
                        />
                    </label>

                    <button type="submit">Create</button>
                </form>
            )}

            {loading && <p class="muted">Loading matches…</p>}

            {!loading && matches.length === 0 && <p>No matches yet. Create one to get started.</p>}

            {!loading && matches.length > 0 && (
                <div class="matches-list">
                    {matches.map((match) => {
                        const assignedScouts = getAssignedScouts(match.id)
                        const detailedStats = matchDetailedStats[match.id]
                        return (
                            <div class="match-card" key={match.id}>
                                <div class="match-card-header">
                                    <div class="match-info">
                                        <div class="strong">{match.label}</div>
                                        <div class="muted small">{new Date(match.start).toLocaleString()}</div>
                                        <div class="muted small">
                                            🔴 Red: {match.red.join(', ')} | 🔵 Blue: {match.blue.join(', ')}
                                        </div>
                                        <div class="muted small">
                                            Pending: {matchStats[match.id]?.pending || 0} · Approved: {matchStats[match.id]?.approved || 0} · Rejected: {matchStats[match.id]?.rejected || 0}
                                        </div>
                                    </div>

                                    <div class="match-card-actions">
                                        <button class="ghost" onClick={() => randomAssignScouts(match.id)}>
                                            Auto-assign scouts
                                        </button>
                                        <button
                                            class="ghost danger"
                                            onClick={() => handleDeleteMatch(match.id, match.label)}
                                        >
                                            Delete match
                                        </button>
                                    </div>
                                </div>

                                {detailedStats && detailedStats.submissionCount > 0 && (
                                    <div class="stat-box">
                                        <div class="strong stat-title">Match Statistics ({detailedStats.submissionCount} approved)</div>
                                        <div class="stat-grid">
                                            <div class="muted small">
                                                <span class="strong">Fuel Scored:</span> {detailedStats.totalFuelScored}
                                                {detailedStats.submissionCount > 0 && ` (avg: ${(detailedStats.totalFuelScored / detailedStats.submissionCount).toFixed(1)})`}
                                            </div>
                                            <div class="muted small">
                                                <span class="strong">Fuel Missed:</span> {detailedStats.totalFuelMissed}
                                                {detailedStats.submissionCount > 0 && ` (avg: ${(detailedStats.totalFuelMissed / detailedStats.submissionCount).toFixed(1)})`}
                                            </div>
                                            <div class="muted small">
                                                <span class="strong">Team Penalties:</span> {detailedStats.totalTeamPenalties}
                                            </div>
                                            <div class="muted small">
                                                <span class="strong">Opponent Penalties:</span> {detailedStats.totalOpponentPenalties}
                                            </div>
                                            {Object.keys(detailedStats.climbLevels).length > 0 && (
                                                <div class="muted small stat-full">
                                                    <span class="strong">Climb Levels:</span> {Object.entries(detailedStats.climbLevels)
                                                        .filter(([level]) => level !== 'none')
                                                        .map(([level, count]) => `${level}: ${count}`)
                                                        .join(', ') || 'none'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {assignedScouts.length > 0 && (
                                    <div class="assigned-scouts">
                                        <div class="muted small strong">Assigned scouts</div>
                                        <ul class="scout-assignments">
                                            {assignedScouts.map((scout) => (
                                                <li key={scout.uid}>
                                                    <span class="muted small">{scout.displayName} → {scout.assignedAlliance} team {scout.assignedTeamNumber}</span>
                                                    <button
                                                        class="ghost small"
                                                        onClick={() => unassignScout(scout.uid, scout.displayName)}
                                                    >
                                                        Unassign
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
