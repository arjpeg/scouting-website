export const DEFAULT_VALUES = {
    fuelScored: 0,
    fuelMissed: 0,
    climbLevel: 'none',
    teamPenalties: 0,
    opponentPenalties: 0,
} as const

export const FIELD_LABELS: Record<string, string> = {
    'auton.fuelScored': 'Auton Fuel Scored',
    'auton.fuelMissed': 'Auton Fuel Missed',
    'auton.climbLevel': 'Auton Climb Level',
    'teleop.fuelScored': 'Teleop Fuel Scored',
    'teleop.fuelMissed': 'Teleop Fuel Missed',
    'teleop.climbLevel': 'Teleop Climb Level',
    'teamPenalties': 'Team Penalties',
    'opponentPenalties': 'Opponent Penalties',
}

export function isDefaultValue(fieldPath: string, value: any): boolean {
    const field = fieldPath.split('.').pop()
    if (!field) return false
    return DEFAULT_VALUES[field as keyof typeof DEFAULT_VALUES] === value
}

export function getFieldLabel(fieldPath: string): string {
    return FIELD_LABELS[fieldPath] || fieldPath
}
