import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import type { Submission, MatchStats, TeamMatchStats, ConflictField, FieldValue } from './types'
import { db } from './firebase'
import { getNestedValue, setNestedValue, getAllFieldPaths } from './utils/nested'
import { isDefaultValue, DEFAULT_VALUES } from './utils/fields'
import { normalizeSubmission } from './utils/submission'

async function getApprovedSubmissions(matchId: string): Promise<Submission[]> {
    const q = query(
        collection(db, 'submissions'),
        where('matchId', '==', matchId),
        where('status', '==', 'approved'),
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(normalizeSubmission)
}

function groupSubmissionsByTeam(submissions: Submission[]): Record<string, Submission[]> {
    const teamSubmissions: Record<string, Submission[]> = {}
    for (const sub of submissions) {
        const key = sub.data.teamNumber
        if (!teamSubmissions[key]) {
            teamSubmissions[key] = []
        }
        teamSubmissions[key].push(sub)
    }
    return teamSubmissions
}

function detectConflicts(submissions: Submission[], fieldPath: string): FieldValue[] {
    const valueMap: Map<string, FieldValue> = new Map()

    for (const sub of submissions) {
        const value = getNestedValue(sub.data, fieldPath)

        // Skip default values
        if (isDefaultValue(fieldPath, value)) {
            continue
        }

        const valueKey = JSON.stringify(value)
        if (!valueMap.has(valueKey)) {
            valueMap.set(valueKey, {
                value,
                submissionIds: [],
                submittedBy: [],
            })
        }
        const fieldValue = valueMap.get(valueKey)!
        fieldValue.submissionIds.push(sub.id)
        if (!fieldValue.submittedBy.includes(sub.createdByName)) {
            fieldValue.submittedBy.push(sub.createdByName)
        }
    }

    return Array.from(valueMap.values())
}

function buildTeamStats(
    matchId: string,
    teamNumber: string,
    submissions: Submission[],
): TeamMatchStats {
    const conflicts: ConflictField[] = []
    const resolvedData: any = {}
    const alliance = submissions[0].data.alliance

    const fieldPaths = getAllFieldPaths(submissions[0].data).filter(
        (path) => path !== 'teamNumber' && path !== 'alliance',
    )

    for (const fieldPath of fieldPaths) {
        const values = detectConflicts(submissions, fieldPath)

        if (values.length === 0) {
            // All values are default, use the default
            const field = fieldPath.split('.').pop()!
            setNestedValue(resolvedData, fieldPath, DEFAULT_VALUES[field as keyof typeof DEFAULT_VALUES])
        } else if (values.length === 1) {
            // No conflict, single value
            setNestedValue(resolvedData, fieldPath, values[0].value)
        } else {
            // Conflict detected
            conflicts.push({
                fieldPath,
                values,
                resolved: false,
            })
        }
    }

    return {
        matchId,
        teamNumber,
        alliance,
        conflicts,
        resolvedData,
        lastUpdated: Date.now(),
    }
}

export async function aggregateMatchStats(matchId: string): Promise<MatchStats | undefined> {
    try {
        const submissions = await getApprovedSubmissions(matchId)

        if (submissions.length === 0) {
            return
        }

        const teamSubmissions = groupSubmissionsByTeam(submissions)
        const teamStats: Record<string, TeamMatchStats> = {}

        for (const [teamNumber, subs] of Object.entries(teamSubmissions)) {
            teamStats[teamNumber] = buildTeamStats(matchId, teamNumber, subs)
        }

        const matchStatsId = `match_${matchId}`
        const hasUnresolvedConflicts = Object.values(teamStats).some((ts) =>
            ts.conflicts.some((c) => !c.resolved),
        )

        const matchStatsDoc: MatchStats = {
            id: matchStatsId,
            matchId,
            teamStats,
            hasUnresolvedConflicts,
            lastUpdated: Date.now(),
        }

        await setDoc(doc(db, 'matchStats', matchStatsId), matchStatsDoc)

        return matchStatsDoc
    } catch (err) {
        console.error('Failed to aggregate match stats', err)
        throw err
    }
}
