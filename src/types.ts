export type Alliance = 'red' | 'blue'

export type TimingPhase = {
    fuelScored: number
    fuelMissed: number
    climbLevel: 'none' | 'low' | 'mid' | 'high' | 'traverse'
}

export type SubmissionData = {
    teamNumber: string
    alliance: Alliance
    auton: TimingPhase
    teleop: TimingPhase
    teamPenalties: number
    opponentPenalties: number
}

export type Match = {
    id: string
    label: string
    red: string[]
    blue: string[]
    start: number
    createdBy?: string
}

export type UserProfile = {
    uid: string
    displayName: string
    email: string
    role: 'admin' | 'moderator' | 'scout'
    assignedMatchId?: string
    assignedTeamNumber?: string
    assignedAlliance?: 'red' | 'blue'
}

export type Submission = {
    id: string
    matchId: string
    data: SubmissionData
    createdBy: string
    createdByName: string
    createdAt: number
    status: 'pending' | 'approved' | 'rejected'
    approvedBy?: string
    approvedAt?: number
    notes?: string
}

export type FieldValue = {
    value: any
    submissionIds: string[]
    submittedBy: string[]
}

export type ConflictField = {
    fieldPath: string
    values: FieldValue[]
    resolved: boolean
    selectedValue?: any
}

export type TeamMatchStats = {
    matchId: string
    teamNumber: string
    alliance: Alliance
    conflicts: ConflictField[]
    resolvedData: Partial<SubmissionData>
    lastUpdated: number
}

export type MatchStats = {
    id: string
    matchId: string
    teamStats: Record<string, TeamMatchStats>
    hasUnresolvedConflicts: boolean
    lastUpdated: number
}
