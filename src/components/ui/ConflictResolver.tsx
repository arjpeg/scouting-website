import type { ConflictField } from '../../types'
import { getFieldLabel } from '../../utils/fields'

export function ConflictResolver({
    teamNumber,
    alliance,
    conflicts,
    onResolve,
}: {
    teamNumber: string
    alliance: string
    conflicts: ConflictField[]
    onResolve: (conflictIndex: number, value: any) => void
}) {
    const unresolvedConflicts = conflicts.filter((c) => !c.resolved)

    if (unresolvedConflicts.length === 0) return null

    return (
        <div class="team-conflicts">
            <h3 class="conflict-team-header">
                Team {teamNumber} ({alliance})
            </h3>
            {conflicts.map((conflict, idx) => {
                if (conflict.resolved) return null

                return (
                    <div class="conflict-item" key={idx}>
                        <div class="conflict-header">
                            <span class="strong">{getFieldLabel(conflict.fieldPath)}</span>
                            <span class="badge">{conflict.values.length} different values</span>
                        </div>
                        <div class="conflict-options">
                            {conflict.values.map((fieldValue, vIdx) => (
                                <button
                                    key={vIdx}
                                    class="conflict-option"
                                    onClick={() => onResolve(idx, fieldValue.value)}
                                >
                                    <div class="option-value">{String(fieldValue.value)}</div>
                                    <div class="muted small">
                                        From {fieldValue.submittedBy.join(', ')} (
                                        {fieldValue.submissionIds.length} submission
                                        {fieldValue.submissionIds.length !== 1 ? 's' : ''})
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
