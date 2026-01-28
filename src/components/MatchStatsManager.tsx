import { useEffect, useState } from 'preact/hooks'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import type { MatchStats, Match } from '../types'
import { db } from '../firebase'
import { setNestedValue } from '../utils/nested'
import { PanelHeader, MessageToast, LoadingState, EmptyState } from './ui/Common'
import { ConflictResolver } from './ui/ConflictResolver'

export function MatchStatsManager({ matches }: { matches: Match[] }) {
    const [matchStats, setMatchStats] = useState<MatchStats[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<string | null>(null)
    const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
    const [showOnlyConflicts, setShowOnlyConflicts] = useState(false)

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'matchStats'),
            (snapshot) => {
                const stats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MatchStats))
                setMatchStats(stats)
                setLoading(false)
            },
            (err) => {
                console.error('Failed to load match stats', err)
                setLoading(false)
            },
        )
        return () => unsub()
    }, [])

    async function resolveConflict(
        matchStatsId: string,
        teamNumber: string,
        conflictIndex: number,
        selectedValue: any,
    ) {
        setMessage(null)
        try {
            const stats = matchStats.find((s) => s.id === matchStatsId)
            if (!stats) return

            const teamStats = stats.teamStats[teamNumber]
            if (!teamStats) return

            const conflict = teamStats.conflicts[conflictIndex]
            const updatedConflicts = [...teamStats.conflicts]
            updatedConflicts[conflictIndex] = {
                ...conflict,
                resolved: true,
                selectedValue,
            }

            const updatedResolvedData = { ...teamStats.resolvedData }
            setNestedValue(updatedResolvedData, conflict.fieldPath, selectedValue)

            const hasUnresolved = updatedConflicts.some((c) => !c.resolved)

            const updatedTeamStats = {
                ...teamStats,
                conflicts: updatedConflicts,
                resolvedData: updatedResolvedData,
                lastUpdated: Date.now(),
            }

            await updateDoc(doc(db, 'matchStats', matchStatsId), {
                [`teamStats.${teamNumber}`]: updatedTeamStats,
                hasUnresolvedConflicts: hasUnresolved || Object.values(stats.teamStats).some(
                    (ts, idx) => Object.keys(stats.teamStats)[idx] !== teamNumber && ts.conflicts.some((c) => !c.resolved)
                ),
                lastUpdated: Date.now(),
            })

            setMessage('Conflict resolved')
        } catch (err) {
            console.error('Failed to resolve conflict', err)
            setMessage('Could not resolve conflict')
        }
    }

    const statsWithConflicts = matchStats.filter((s) => s.hasUnresolvedConflicts)
    const displayedStats = showOnlyConflicts ? statsWithConflicts : matchStats

    return (
        <section class="panel">
            <PanelHeader
                eyebrow="Match Statistics"
                title="Consolidated match data"
                description="Review and resolve conflicts from multiple approved submissions."
                action={
                    matchStats.length > 0 && (
                        <div class="pill-group">
                            <button
                                class={`pill ${!showOnlyConflicts ? 'pill-active' : ''}`}
                                onClick={() => setShowOnlyConflicts(false)}
                            >
                                All Matches
                            </button>
                            <button
                                class={`pill ${showOnlyConflicts ? 'pill-active' : ''}`}
                                onClick={() => setShowOnlyConflicts(true)}
                            >
                                Conflicts Only {statsWithConflicts.length > 0 && `(${statsWithConflicts.length})`}
                            </button>
                        </div>
                    )
                }
            />

            <MessageToast message={message} />
            {loading && <LoadingState text="Loading match statistics…" />}

            {!loading && matchStats.length === 0 && (
                <EmptyState text="No match statistics yet. Stats are generated when submissions are approved." />
            )}

            {!loading && displayedStats.length === 0 && showOnlyConflicts && (
                <EmptyState text="No conflicts to resolve. All approved submissions are consistent." />
            )}

            {!loading && displayedStats.length > 0 && (
                <div class="matches-list">
                    {displayedStats.map((stats) => {
                        const match = matches.find((m) => m.id === stats.matchId)
                        const isExpanded = expandedMatch === stats.id
                        const hasConflicts = stats.hasUnresolvedConflicts
                        const teamCount = Object.keys(stats.teamStats).length

                        return (
                            <div class="match-card" key={stats.id}>
                                <div class="match-card-header">
                                    <div class="match-info">
                                        <div class="strong">{match?.label || stats.matchId}</div>
                                        <div class="muted small">
                                            {teamCount} team{teamCount !== 1 ? 's' : ''} tracked
                                            {hasConflicts && ` · ${Object.values(stats.teamStats).reduce((sum, ts) => sum + ts.conflicts.filter(c => !c.resolved).length, 0)} unresolved conflicts`}
                                        </div>
                                    </div>
                                    <div class="match-card-actions">
                                        <button class="ghost" onClick={() => setExpandedMatch(isExpanded ? null : stats.id)}>
                                            {isExpanded ? 'Hide Details' : 'View Details'}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div class="conflicts-container">
                                        {Object.entries(stats.teamStats).map(([teamNumber, teamStats]) => {
                                            const unresolvedConflicts = teamStats.conflicts.filter(c => !c.resolved)

                                            return (
                                                <div key={teamNumber} class="team-stats-display">
                                                    <div class="team-stats-header">
                                                        <div class="strong">Team {teamNumber}</div>
                                                        <div class="badge" style={{
                                                            background: teamStats.alliance === 'red' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                                            borderColor: teamStats.alliance === 'red' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)'
                                                        }}>
                                                            {teamStats.alliance === 'red' ? '🔴' : '🔵'} {teamStats.alliance}
                                                        </div>
                                                    </div>

                                                    {unresolvedConflicts.length > 0 && (
                                                        <ConflictResolver
                                                            teamNumber={teamNumber}
                                                            alliance={teamStats.alliance}
                                                            conflicts={unresolvedConflicts}
                                                            onResolve={(conflictIdx, value) => {
                                                                const originalIdx = teamStats.conflicts.findIndex(c =>
                                                                    c.fieldPath === unresolvedConflicts[conflictIdx].fieldPath
                                                                )
                                                                resolveConflict(stats.id, teamNumber, originalIdx, value)
                                                            }}
                                                        />
                                                    )}

                                                    <div class="stat-box">
                                                        <div class="strong stat-title">Consolidated Data</div>
                                                        <div class="stat-grid">
                                                            <div class="muted small">
                                                                <span class="strong">Auton Fuel Scored:</span> {teamStats.resolvedData.auton?.fuelScored ?? 0}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Auton Fuel Missed:</span> {teamStats.resolvedData.auton?.fuelMissed ?? 0}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Auton Climb:</span> {teamStats.resolvedData.auton?.climbLevel ?? 'none'}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Teleop Fuel Scored:</span> {teamStats.resolvedData.teleop?.fuelScored ?? 0}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Teleop Fuel Missed:</span> {teamStats.resolvedData.teleop?.fuelMissed ?? 0}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Teleop Climb:</span> {teamStats.resolvedData.teleop?.climbLevel ?? 'none'}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Team Penalties:</span> {teamStats.resolvedData.teamPenalties ?? 0}
                                                            </div>
                                                            <div class="muted small">
                                                                <span class="strong">Opponent Penalties:</span> {teamStats.resolvedData.opponentPenalties ?? 0}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
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
