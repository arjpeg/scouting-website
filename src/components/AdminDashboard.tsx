import { useEffect, useState } from 'preact/hooks'
import { doc, getDocs, collection, updateDoc, setDoc } from 'firebase/firestore'
import type { Match, UserProfile } from '../types'
import { db } from '../firebase'

export function AdminDashboard({ matches }: { matches: Match[] }) {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        async function loadUsers() {
            setLoading(true)
            try {
                const snapshot = await getDocs(collection(db, 'users'))
                const rows: UserProfile[] = snapshot.docs.map((d) => d.data() as UserProfile)
                setUsers(rows)
            } catch (err) {
                console.error('Failed to load users', err)
                setMessage('Could not load users yet')
            } finally {
                setLoading(false)
            }
        }

        loadUsers()
    }, [])

    async function assignTeam(uid: string, matchId?: string, teamNumber?: string, alliance?: 'red' | 'blue') {
        setMessage(null)
        try {
            await updateDoc(doc(db, 'users', uid), {
                assignedMatchId: matchId || null,
                assignedTeamNumber: teamNumber || null,
                assignedAlliance: alliance || null,
            })
            setUsers((prev) =>
                prev.map((user) =>
                    user.uid === uid
                        ? { ...user, assignedMatchId: matchId, assignedTeamNumber: teamNumber, assignedAlliance: alliance }
                        : user,
                ),
            )
            setMessage('Assignment saved')
        } catch (err) {
            console.error('Failed to assign team', err)
            setMessage('Could not assign team')
        }
    }

    async function unassignScout(uid: string, scoutName: string) {
        setMessage(null)
        try {
            await updateDoc(doc(db, 'users', uid), {
                assignedMatchId: null,
                assignedTeamNumber: null,
                assignedAlliance: null,
            })
            setUsers((prev) =>
                prev.map((user) =>
                    user.uid === uid
                        ? { ...user, assignedMatchId: undefined, assignedTeamNumber: undefined, assignedAlliance: undefined }
                        : user,
                ),
            )
            setMessage(`Unassigned ${scoutName}`)
        } catch (err) {
            console.error('Failed to unassign scout', err)
            setMessage('Could not unassign scout')
        }
    }

    async function updateRole(uid: string, newRole: 'scout' | 'moderator' | 'admin') {
        setMessage(null)
        try {
            await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true })
            setUsers((prev) => prev.map((user) => (user.uid === uid ? { ...user, role: newRole } : user)))
            setMessage(`User role updated to ${newRole}`)
        } catch (err) {
            console.error('Failed to update role', err)
            setMessage('Could not update role')
        }
    }

    // Only show scouts (not admins or moderators) since they can't submit forms
    const scouts = users.filter(user => user.role === 'scout')

    return (
        <>
            {/* User Role Management Section */}
            <section class="panel">
                <header class="panel-header">
                    <div>
                        <p class="eyebrow">Admin</p>
                        <h2>User roles</h2>
                        <p class="muted">Manage user permissions and access levels.</p>
                    </div>
                </header>
                {message && <p class="toast">{message}</p>}
                {loading && <p class="muted">Loading users…</p>}

                {!loading && users.length === 0 && <p>No users yet. Users will appear here after signing in.</p>}

                {!loading && users.length > 0 && (
                    <div class="user-roles-list">
                        {users.map((user) => (
                            <div class="role-card" key={user.uid}>
                                <div class="role-card-info">
                                    <div class="strong">{user.displayName || 'Unnamed user'}</div>
                                    <div class="muted small">{user.email}</div>
                                </div>
                                <div class="form-group compact">
                                    <label class="form-label">Role</label>
                                    <select
                                        value={user.role}
                                        onChange={(e) => {
                                            const newRole = (e.target as HTMLSelectElement).value as 'scout' | 'moderator' | 'admin'
                                            updateRole(user.uid, newRole)
                                        }}
                                        class="role-select"
                                    >
                                        <option value="scout">Scout</option>
                                        <option value="moderator">Moderator</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div class="badge">{user.role}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Scout Team Assignments Section */}
            <section class="panel">
                <header class="panel-header">
                    <div>
                        <p class="eyebrow">Admin</p>
                        <h2>Scout team assignments</h2>
                        <p class="muted">Assign each scout to a specific team on a specific match.</p>
                    </div>
                </header>

                {!loading && scouts.length === 0 && <p>No scouts yet. Users with scout role will appear here.</p>}

                {!loading && scouts.length > 0 && (
                    <div class="scout-list">
                        {scouts.map((user) => (
                            <div class="scout-card" key={user.uid}>
                                <div class="scout-info">
                                    <div class="strong">{user.displayName || 'Unnamed scout'}</div>
                                    <div class="muted small">{user.email}</div>
                                    <div class="badge">{user.role}</div>
                                </div>

                                <div class="assignment-section">
                                    <div class="assignment-row">
                                        <div class="form-group compact">
                                            <label class="form-label">Match Assignment</label>
                                            <select
                                                value={user.assignedMatchId || ''}
                                                onChange={(e) => {
                                                    const matchId = (e.target as HTMLSelectElement).value || undefined
                                                    assignTeam(user.uid, matchId, user.assignedTeamNumber, user.assignedAlliance)
                                                }}
                                            >
                                                <option value="">Select match...</option>
                                                {matches.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {user.assignedMatchId && matches.find((m) => m.id === user.assignedMatchId) && (
                                            <>
                                                <div class="form-group compact">
                                                    <label class="form-label">Alliance</label>
                                                    <select
                                                        value={user.assignedAlliance || ''}
                                                        onChange={(e) => {
                                                            const alliance = (e.target as HTMLSelectElement).value
                                                            if (alliance) assignTeam(user.uid, user.assignedMatchId, user.assignedTeamNumber, alliance as 'red' | 'blue')
                                                        }}
                                                    >
                                                        <option value="">Select alliance...</option>
                                                        <option value="red">🔴 Red Alliance</option>
                                                        <option value="blue">🔵 Blue Alliance</option>
                                                    </select>
                                                </div>

                                                <div class="form-group compact">
                                                    <label class="form-label">Team Number</label>
                                                    <select
                                                        value={user.assignedTeamNumber || ''}
                                                        onChange={(e) => {
                                                            const teamNumber = (e.target as HTMLSelectElement).value || undefined
                                                            assignTeam(user.uid, user.assignedMatchId, teamNumber, user.assignedAlliance as 'red' | 'blue')
                                                        }}
                                                        disabled={!user.assignedAlliance}
                                                    >
                                                        <option value="">Select team...</option>
                                                        {user.assignedAlliance &&
                                                            matches
                                                                .find((m) => m.id === user.assignedMatchId)
                                                                ?.[user.assignedAlliance]?.map((team) => (
                                                                    <option key={team} value={team}>
                                                                        Team {team}
                                                                    </option>
                                                                ))}
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div class="assignment-actions">
                                        {user.assignedMatchId && (
                                            <button class="ghost small" onClick={() => unassignScout(user.uid, user.displayName)}>
                                                Clear Assignment
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    )
}